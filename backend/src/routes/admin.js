import { Router } from 'express';
import { pool } from '../models/db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

adminRouter.get('/stats', async (req, res, next) => {
  try {
    const [userPlans, scanStatuses, todayScans, topDomains] = await Promise.all([
      pool.query('SELECT plan, COUNT(*) as count FROM users GROUP BY plan ORDER BY count DESC'),
      pool.query('SELECT status, COUNT(*) as count FROM scans GROUP BY status ORDER BY count DESC'),
      pool.query("SELECT COUNT(*) FROM scans WHERE created_at > NOW() - INTERVAL '24 hours'"),
      pool.query(`SELECT domain, COUNT(*) as scan_count, MAX(security_score) as best_score
                  FROM scans WHERE status='completed' GROUP BY domain ORDER BY scan_count DESC LIMIT 5`),
    ]);
    const byPlan = Object.fromEntries(userPlans.rows.map(r => [r.plan, parseInt(r.count)]));
    const byStatus = Object.fromEntries(scanStatuses.rows.map(r => [r.status, parseInt(r.count)]));
    res.json({
      users: {
        total: userPlans.rows.reduce((s, r) => s + parseInt(r.count), 0),
        free: byPlan.free || 0,
        pro: byPlan.pro || 0,
        agency: byPlan.agency || 0,
      },
      scans: {
        total: scanStatuses.rows.reduce((s, r) => s + parseInt(r.count), 0),
        by_status: byStatus,
        today: parseInt(todayScans.rows[0].count),
      },
      top_domains: topDomains.rows,
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/users', async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const [usersRes, countRes] = await Promise.all([
      pool.query(
        'SELECT id, email, full_name, plan, is_admin, email_verified, created_at FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [parseInt(limit), offset]
      ),
      pool.query('SELECT COUNT(*) FROM users'),
    ]);
    res.json({ users: usersRes.rows, total: parseInt(countRes.rows[0].count), page: parseInt(page) });
  } catch (err) {
    next(err);
  }
});

adminRouter.patch('/users/:userId/plan', async (req, res, next) => {
  try {
    const { plan } = req.body;
    if (!['free', 'pro', 'agency'].includes(plan)) return res.status(400).json({ error: 'Invalid plan' });
    const { rows } = await pool.query(
      'UPDATE users SET plan=$1 WHERE id=$2 RETURNING id, email, plan',
      [plan, req.params.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/scans', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT s.*, u.email FROM scans s LEFT JOIN users u ON s.user_id=u.id ORDER BY s.created_at DESC LIMIT 100');
    res.json({ scans: rows });
  } catch (err) {
    next(err);
  }
});
