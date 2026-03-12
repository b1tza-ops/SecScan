// Monitoring scheduler — auto re-scans domains with monitoring enabled
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { pool } from './models/db.js';
import { scanQueue } from './queue/scanQueue.js';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const monitorQueue = new Queue('monitoring', { connection });

export async function startMonitoringScheduler() {
  // Schedule the monitoring check to run every hour
  await monitorQueue.add(
    'check-monitored-domains',
    {},
    {
      repeat: { every: 60 * 60 * 1000 }, // every hour
      jobId: 'monitoring-check',
      removeOnComplete: 5,
      removeOnFail: 3,
    }
  );

  const worker = new Worker('monitoring', async () => {
    await runMonitoringCheck();
  }, { connection });

  worker.on('failed', (job, err) => console.error('Monitoring job failed:', err.message));
  console.log('Monitoring scheduler started');
  return worker;
}

async function runMonitoringCheck() {
  const now = new Date();
  const hour = now.getUTCHours();

  // Get all domains with monitoring enabled
  const { rows: domains } = await pool.query(`
    SELECT d.id, d.domain, d.monitoring_interval, d.last_scanned_at, d.user_id,
           u.email, u.plan
    FROM domains d
    JOIN users u ON d.user_id = u.id
    WHERE d.monitoring_enabled = true
      AND u.plan IN ('pro', 'agency')
  `);

  for (const domain of domains) {
    if (!shouldScanNow(domain.monitoring_interval, domain.last_scanned_at, now)) continue;

    // Find last completed scan for this domain to get previous score
    const { rows: lastScans } = await pool.query(
      `SELECT security_score FROM scans WHERE domain=$1 AND status='completed' ORDER BY created_at DESC LIMIT 1`,
      [domain.domain]
    );

    // Enqueue a new scan
    const { rows: scanRows } = await pool.query(
      `INSERT INTO scans (user_id, domain, ip_address) VALUES ($1,$2,'monitor') RETURNING id`,
      [domain.user_id, domain.domain]
    );

    await scanQueue.add('scan', {
      scanId: scanRows[0].id,
      domain: domain.domain,
      isMonitoring: true,
      userEmail: domain.email,
      prevScore: lastScans[0]?.security_score ?? null,
    }, {
      attempts: 2,
      backoff: { type: 'exponential', delay: 10000 },
    });

    console.log(`Scheduled monitoring scan for ${domain.domain}`);
  }
}

function shouldScanNow(interval, lastScannedAt, now) {
  if (!lastScannedAt) return true;
  const last = new Date(lastScannedAt);
  const hoursSince = (now - last) / (1000 * 60 * 60);

  if (interval === 'daily') return hoursSince >= 24;
  if (interval === 'weekly') return hoursSince >= 168;
  return false;
}
