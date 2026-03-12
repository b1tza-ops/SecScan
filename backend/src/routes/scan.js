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

    // Rate limit anonymous scans by IP: 5/day
    if (!req.user) {
      const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
      const { rows: anonRows } = await pool.query(
        `INSERT INTO anon_scan_tracking (ip_address, scan_date, scan_count)
         VALUES ($1, CURRENT_DATE, 1)
         ON CONFLICT (ip_address, scan_date) DO UPDATE SET scan_count = anon_scan_tracking.scan_count + 1
         RETURNING scan_count`,
        [clientIp]
      );
      if (parseInt(anonRows[0].scan_count) > 5) {
        return res.status(429).json({ error: 'Anonymous scan limit reached (5/day). Create a free account for more scans.' });
      }
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

    const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
    const { rows } = await pool.query(
      'INSERT INTO scans (user_id, domain, ip_address) VALUES ($1,$2,$3) RETURNING id, domain, status, created_at',
      [req.user?.id || null, domain, clientIp]
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

scanRouter.get('/history/:domain', requireAuth, async (req, res, next) => {
  try {
    const domain = req.params.domain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();
    // Restrict to scans owned by the authenticated user for that domain
    const { rows } = await pool.query(
      `SELECT id, security_score, critical_count, warning_count, info_count, created_at, completed_at
       FROM scans
       WHERE domain=$1 AND user_id=$2 AND status='completed'
       ORDER BY created_at DESC
       LIMIT 30`,
      [domain, req.user.id]
    );
    res.json({ domain, history: rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/scan/:id/rescan — re-run a scan for the same domain
scanRouter.post('/:id/rescan', requireAuth, [param('id').isUUID()], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { rows: orig } = await pool.query('SELECT domain, user_id FROM scans WHERE id=$1', [req.params.id]);
    if (!orig.length) return res.status(404).json({ error: 'Scan not found' });
    if (orig[0].user_id !== req.user.id && !req.user.is_admin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const domain = orig[0].domain;
    const plan = req.user.plan;
    const limit = PLAN_LIMITS[plan] || 3;
    if (limit !== Infinity) {
      const { rows } = await pool.query(
        "SELECT COUNT(*) FROM scans WHERE user_id=$1 AND created_at > date_trunc('month', NOW())",
        [req.user.id]
      );
      if (parseInt(rows[0].count) >= limit) {
        return res.status(429).json({ error: `Monthly scan limit reached for ${plan} plan.` });
      }
    }

    const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
    const { rows } = await pool.query(
      'INSERT INTO scans (user_id, domain, ip_address) VALUES ($1,$2,$3) RETURNING id, domain, status, created_at',
      [req.user.id, domain, clientIp]
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
