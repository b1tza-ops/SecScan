import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { pool } from '../models/db.js';
import { scanQueue } from '../queue/scanQueue.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { scanLimiter } from '../middleware/rateLimit.js';

export const scanRouter = Router();

const PLAN_LIMITS = { free: 3, pro: Infinity, agency: Infinity };

function sanitizeDomain(input) {
  return input.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase().trim();
}

scanRouter.post('/', scanLimiter, optionalAuth, [
  body('domain').notEmpty().isString(),
  body('consent').equals('true').withMessage('You must confirm you have permission to scan this domain'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const domain = sanitizeDomain(req.body.domain);

    // Basic domain validation
    if (!/^[a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?(\.[a-z]{2,})+$/.test(domain)) {
      return res.status(400).json({ error: 'Invalid domain format' });
    }

    // Enforce plan scan limits for logged-in users
    if (req.user) {
      const plan = req.user.plan;
      const limit = PLAN_LIMITS[plan] || 3;
      if (limit !== Infinity) {
        const { rows } = await pool.query(
          "SELECT COUNT(*) FROM scans WHERE user_id=$1 AND created_at > date_trunc('month', NOW())",
          [req.user.id]
        );
        if (parseInt(rows[0].count) >= limit) {
          return res.status(429).json({ error: `Monthly scan limit reached for ${plan} plan. Upgrade to continue.` });
        }
      }
    }

    const { rows } = await pool.query(
      'INSERT INTO scans (user_id, domain) VALUES ($1,$2) RETURNING id, domain, status, created_at',
      [req.user?.id || null, domain]
    );
    const scan = rows[0];

    await scanQueue.add('scan', { scanId: scan.id, domain }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });

    res.status(202).json({ scan });
  } catch (err) {
    next(err);
  }
});

scanRouter.get('/:id', [param('id').isUUID()], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { rows: scanRows } = await pool.query('SELECT * FROM scans WHERE id=$1', [req.params.id]);
    if (!scanRows.length) return res.status(404).json({ error: 'Scan not found' });

    const scan = scanRows[0];
    const { rows: modules } = await pool.query('SELECT * FROM scan_results WHERE scan_id=$1 ORDER BY created_at', [scan.id]);
    const { rows: vulns } = await pool.query('SELECT * FROM vulnerabilities WHERE scan_id=$1 ORDER BY severity', [scan.id]);

    res.json({ scan, modules, vulnerabilities: vulns });
  } catch (err) {
    next(err);
  }
});

scanRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, domain, status, security_score, critical_count, warning_count, created_at, completed_at FROM scans WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    res.json({ scans: rows });
  } catch (err) {
    next(err);
  }
});
