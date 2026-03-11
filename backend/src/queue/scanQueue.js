import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { pool } from '../models/db.js';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export const scanQueue = new Queue('scans', { connection });

export function startScanWorker() {
  const worker = new Worker('scans', async (job) => {
    const { scanId, domain } = job.data;

    await pool.query("UPDATE scans SET status='running', started_at=NOW() WHERE id=$1", [scanId]);

    try {
      // Call Python scanner microservice
      const response = await fetch(`${process.env.SCANNER_SERVICE_URL}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scan_id: scanId, domain }),
      });

      if (!response.ok) throw new Error(`Scanner returned ${response.status}`);

      const result = await response.json();

      // Persist module results
      for (const mod of result.modules) {
        await pool.query(
          'INSERT INTO scan_results (scan_id, module, status, score, findings, raw_data) VALUES ($1,$2,$3,$4,$5,$6)',
          [scanId, mod.module, mod.status, mod.score, JSON.stringify(mod.findings), JSON.stringify(mod.raw_data || {})]
        );

        // Insert individual vulnerabilities
        for (const finding of mod.findings) {
          await pool.query(
            'INSERT INTO vulnerabilities (scan_id, title, description, severity, category, fix_recommendation, fix_example) VALUES ($1,$2,$3,$4,$5,$6,$7)',
            [scanId, finding.title, finding.description, finding.severity, mod.module, finding.fix_recommendation, finding.fix_example || null]
          );
        }
      }

      await pool.query(
        "UPDATE scans SET status='completed', security_score=$1, critical_count=$2, warning_count=$3, info_count=$4, owasp_summary=$5, completed_at=NOW() WHERE id=$6",
        [result.security_score, result.critical_count, result.warning_count, result.info_count, JSON.stringify(result.owasp_summary || {}), scanId]
      );

      // Update domain tracking
      await pool.query(
        'UPDATE domains SET last_scanned_at=NOW(), last_score=$1 WHERE domain=$2',
        [result.security_score, domain]
      ).catch(() => {});

      // Send webhook notification for monitored domains
      try {
        const { rows: domainRows } = await pool.query(
          'SELECT webhook_url FROM domains WHERE domain=$1 AND monitoring_enabled=true AND webhook_url IS NOT NULL',
          [domain]
        );
        if (domainRows.length && domainRows[0].webhook_url) {
          const webhookUrl = domainRows[0].webhook_url;
          const scoreEmoji = result.security_score >= 80 ? '🟢' : result.security_score >= 60 ? '🟡' : '🔴';
          const payload = {
            text: `${scoreEmoji} SecurityScan completed for *${domain}*`,
            attachments: [{
              color: result.security_score >= 80 ? 'good' : result.security_score >= 60 ? 'warning' : 'danger',
              fields: [
                { title: 'Security Score', value: `${result.security_score}/100`, short: true },
                { title: 'Critical & High', value: String(result.critical_count), short: true },
                { title: 'Warnings', value: String(result.warning_count), short: true },
                { title: 'View Report', value: `${process.env.FRONTEND_URL}/scan/${scanId}`, short: false },
              ],
            }],
          };
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }).catch(() => {});
        }
      } catch {
        // Don't fail the scan if webhook delivery fails
      }
    } catch (err) {
      await pool.query("UPDATE scans SET status='failed', completed_at=NOW() WHERE id=$1", [scanId]);
      throw err;
    }
  }, {
    connection,
    concurrency: 5,
  });

  worker.on('failed', (job, err) => console.error(`Scan job ${job?.id} failed:`, err.message));
  console.log('Scan worker started');
  return worker;
}
