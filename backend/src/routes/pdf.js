import { Router } from 'express';
import { pool } from '../models/db.js';
import { requireAuth } from '../middleware/auth.js';
import PDFDocument from 'pdfkit';

export const pdfRouter = Router();

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

const COLORS = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#3b82f6',
  info: '#6b7280',
  green: '#22c55e',
  dark: '#0f172a',
  gray: '#6b7280',
  lightgray: '#94a3b8',
  accent: '#6366f1',
  bg: '#1e293b',
};

function scoreColor(score) {
  if (score >= 80) return COLORS.green;
  if (score >= 60) return COLORS.medium;
  if (score >= 40) return COLORS.high;
  return COLORS.critical;
}

function scoreGrade(score) {
  if (score >= 80) return 'Good';
  if (score >= 60) return 'Fair';
  if (score >= 40) return 'Poor';
  return 'Critical';
}

// GET /api/pdf/:scanId — download PDF report (Pro/Agency only)
pdfRouter.get('/:scanId', requireAuth, async (req, res, next) => {
  try {
    const { rows: scanRows } = await pool.query('SELECT * FROM scans WHERE id=$1', [req.params.scanId]);
    if (!scanRows.length) return res.status(404).json({ error: 'Scan not found' });
    const scan = scanRows[0];

    // Only allow the scan owner to download the PDF
    if (scan.user_id && scan.user_id !== req.user.id && !req.user.is_admin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (req.user.plan === 'free') {
      return res.status(403).json({ error: 'PDF export requires Pro or Agency plan. Upgrade at /dashboard.' });
    }

    const { rows: vulns } = await pool.query(
      'SELECT * FROM vulnerabilities WHERE scan_id=$1 ORDER BY severity',
      [scan.id]
    );

    const { rows: modules } = await pool.query(
      'SELECT module, status, score, findings FROM scan_results WHERE scan_id=$1 ORDER BY created_at',
      [scan.id]
    );

    const doc = new PDFDocument({ margin: 50, size: 'A4', compress: true });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="securityscan-${scan.domain}-${new Date(scan.created_at).toISOString().split('T')[0]}.pdf"`,
    });
    doc.pipe(res);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = 50;
    const contentWidth = pageWidth - margin * 2;

    // ── HEADER BAND ──────────────────────────────────────────────────────────
    doc.rect(0, 0, pageWidth, 90).fill(COLORS.dark);
    doc.fill(COLORS.accent).font('Helvetica-Bold').fontSize(20).text('SecurityScan', margin, 28);
    doc.fill(COLORS.lightgray).font('Helvetica').fontSize(10).text('Security Audit Report', margin, 52);
    doc.fill(COLORS.lightgray).fontSize(10).text(
      new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      margin, 52, { width: contentWidth, align: 'right' }
    );

    doc.moveDown(2.5);

    // ── DOMAIN + SCORE ────────────────────────────────────────────────────────
    const sc = scan.security_score ?? 0;
    doc.fill(COLORS.dark).font('Helvetica-Bold').fontSize(26).text(scan.domain, { align: 'center' });
    doc.moveDown(0.3);
    doc.fill(scoreColor(sc)).font('Helvetica-Bold').fontSize(56).text(String(sc), { align: 'center' });
    doc.fill(COLORS.gray).font('Helvetica').fontSize(13).text('out of 100', { align: 'center' });
    doc.moveDown(0.2);
    doc.fill(scoreColor(sc)).font('Helvetica-Bold').fontSize(16).text(scoreGrade(sc), { align: 'center' });
    doc.moveDown(0.5);
    doc.fill(COLORS.gray).font('Helvetica').fontSize(9).text(
      `Completed: ${scan.completed_at ? new Date(scan.completed_at).toLocaleString() : 'N/A'}`,
      { align: 'center' }
    );
    doc.moveDown(1.5);

    // ── SUMMARY STATS ─────────────────────────────────────────────────────────
    const criticals = vulns.filter(v => v.severity === 'critical' || v.severity === 'high');
    const warnings = vulns.filter(v => v.severity === 'medium');
    const infos = vulns.filter(v => v.severity === 'low' || v.severity === 'info');

    const boxY = doc.y;
    const boxH = 60;
    const boxW = (contentWidth - 20) / 3;

    const statsBoxes = [
      { label: 'Critical & High', count: criticals.length, color: COLORS.critical },
      { label: 'Medium Warnings', count: warnings.length, color: COLORS.medium },
      { label: 'Low & Info', count: infos.length, color: COLORS.info },
    ];

    statsBoxes.forEach((box, i) => {
      const x = margin + i * (boxW + 10);
      doc.roundedRect(x, boxY, boxW, boxH, 6).fill('#f8fafc').stroke('#e2e8f0');
      doc.fill(box.color).font('Helvetica-Bold').fontSize(28).text(String(box.count), x, boxY + 8, { width: boxW, align: 'center' });
      doc.fill(COLORS.gray).font('Helvetica').fontSize(9).text(box.label, x, boxY + 40, { width: boxW, align: 'center' });
    });

    doc.moveDown(5);

    // ── MODULE SUMMARY ─────────────────────────────────────────────────────────
    if (modules.length > 0) {
      doc.fill(COLORS.dark).font('Helvetica-Bold').fontSize(14).text('Module Results');
      doc.moveDown(0.4);

      const modLabels = {
        ssl: 'SSL/TLS', headers: 'Security Headers', dns: 'DNS Security',
        cms: 'CMS Detection', js_libraries: 'JS Libraries', ports: 'Open Ports',
        cookies: 'Cookie Security', robots: 'robots.txt', https_redirect: 'HTTPS Redirect',
        exposed_files: 'Exposed Files', subdomain_takeover: 'Subdomain Takeover', security_txt: 'security.txt',
      };

      modules.forEach((mod) => {
        const findings = Array.isArray(mod.findings) ? mod.findings : JSON.parse(mod.findings || '[]');
        const hasCritical = findings.some(f => f.severity === 'critical' || f.severity === 'high');
        const hasMedium = findings.some(f => f.severity === 'medium');
        const statusColor = hasCritical ? COLORS.critical : hasMedium ? COLORS.medium : COLORS.green;
        const statusText = hasCritical ? '✗' : hasMedium ? '!' : '✓';
        doc.fill(statusColor).font('Helvetica-Bold').fontSize(10).text(statusText, { continued: true });
        doc.fill(COLORS.dark).font('Helvetica').fontSize(10).text(
          `  ${modLabels[mod.module] || mod.module} — ${findings.length} finding${findings.length !== 1 ? 's' : ''}`
        );
      });
      doc.moveDown(1);
    }

    // ── FINDINGS ───────────────────────────────────────────────────────────────
    if (vulns.length > 0) {
      doc.addPage();
      doc.fill(COLORS.dark).font('Helvetica-Bold').fontSize(16).text('Security Findings');
      doc.moveDown(0.5);

      const sorted = [...vulns].sort(
        (a, b) => (SEVERITY_ORDER[a.severity] ?? 5) - (SEVERITY_ORDER[b.severity] ?? 5)
      );

      for (const v of sorted) {
        if (doc.y > pageHeight - 130) doc.addPage();

        const sevColor = COLORS[v.severity] || COLORS.info;

        // Severity pill + title
        doc.fill(sevColor).font('Helvetica-Bold').fontSize(11)
          .text(`[${v.severity.toUpperCase()}]`, { continued: true });
        doc.fill(COLORS.dark).font('Helvetica-Bold').fontSize(11)
          .text(`  ${v.title}`);

        if (v.description) {
          doc.fill(COLORS.gray).font('Helvetica').fontSize(9)
            .text(v.description, { indent: 12, lineGap: 1 });
        }

        if (v.fix_recommendation) {
          doc.fill('#374151').font('Helvetica-Oblique').fontSize(9)
            .text(`Fix: ${v.fix_recommendation}`, { indent: 12 });
        }

        if (v.fix_example) {
          doc.fill('#059669').font('Courier').fontSize(8)
            .text(v.fix_example, { indent: 12, lineGap: 1 });
        }

        if (v.category) {
          doc.fill('#818cf8').font('Helvetica').fontSize(8)
            .text(`OWASP: ${v.category}`, { indent: 12 });
        }

        doc.moveDown(0.8);
        doc.moveTo(margin, doc.y).lineTo(pageWidth - margin, doc.y).stroke('#f1f5f9');
        doc.moveDown(0.3);
      }
    } else {
      doc.fill(COLORS.green).font('Helvetica-Bold').fontSize(14)
        .text('No security issues found. Your site passed all checks!', { align: 'center' });
    }

    // ── FOOTER ─────────────────────────────────────────────────────────────────
    doc.moveDown(2);
    doc.fill(COLORS.gray).font('Helvetica').fontSize(8)
      .text('Generated by SecurityScan — Non-intrusive security auditing only', { align: 'center' });
    doc.fill(COLORS.gray).fontSize(8)
      .text('This report reflects the state of the site at time of scan. Results may change over time.', { align: 'center' });

    doc.end();
  } catch (err) {
    next(err);
  }
});
