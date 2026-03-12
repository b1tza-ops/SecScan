import { Router } from 'express';
import { pool } from '../models/db.js';
import { requireAuth } from '../middleware/auth.js';

export const userRouter = Router();

userRouter.use(requireAuth);

userRouter.get('/profile', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, email, full_name, plan, api_key, is_admin, created_at FROM users WHERE id=$1',
      [req.user.id]
    );
    res.json({ user: rows[0] });
  } catch (err) {
    next(err);
  }
});

userRouter.get('/scans', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, domain, status, security_score, critical_count, warning_count, info_count, created_at, completed_at FROM scans WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100',
      [req.user.id]
    );
    res.json({ scans: rows });
  } catch (err) {
    next(err);
  }
});

userRouter.get('/domains', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM domains WHERE user_id=$1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ domains: rows });
  } catch (err) {
    next(err);
  }
});

userRouter.post('/domains/:domainId/monitor', async (req, res, next) => {
  try {
    const { enabled, interval } = req.body;
    const safeInterval = ['daily', 'weekly'].includes(interval) ? interval : 'weekly';
    const { rows } = await pool.query(
      'UPDATE domains SET monitoring_enabled=$1, monitoring_interval=$2 WHERE id=$3 AND user_id=$4 RETURNING *',
      [enabled, safeInterval, req.params.domainId, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Domain not found' });
    res.json({ domain: rows[0] });
  } catch (err) {
    next(err);
  }
});

userRouter.post('/domains/:domainId/webhook', async (req, res, next) => {
  try {
    if (req.user.plan === 'free') {
      return res.status(403).json({ error: 'Webhook alerts require Pro or Agency plan.' });
    }
    const { webhook_url } = req.body;
    if (webhook_url && !/^https:\/\/.+/.test(webhook_url)) {
      return res.status(400).json({ error: 'Webhook URL must start with https://' });
    }
    const { rows } = await pool.query(
      'UPDATE domains SET webhook_url=$1 WHERE id=$2 AND user_id=$3 RETURNING *',
      [webhook_url || null, req.params.domainId, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Domain not found' });
    res.json({ domain: rows[0] });
  } catch (err) {
    next(err);
  }
});

userRouter.patch('/notifications', async (req, res, next) => {
  try {
    const { email_alerts } = req.body;
    if (typeof email_alerts !== 'boolean') return res.status(400).json({ error: 'email_alerts must be a boolean' });
    await pool.query('UPDATE users SET email_alerts=$1 WHERE id=$2', [email_alerts, req.user.id]);
    res.json({ ok: true, email_alerts });
  } catch (err) {
    next(err);
  }
});

userRouter.post('/regenerate-api-key', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "UPDATE users SET api_key=encode(gen_random_bytes(32),'hex') WHERE id=$1 RETURNING api_key",
      [req.user.id]
    );
    res.json({ api_key: rows[0].api_key });
  } catch (err) {
    next(err);
  }
});
