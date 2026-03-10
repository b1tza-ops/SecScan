import { Router } from 'express';
import { pool } from '../models/db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

adminRouter.get('/stats', async (req, res, next) => {
  try {
    const [users, scans, todayScans] = await Promise.all([
      pool.query('SELECT COUNT(*), plan, COUNT(*) FILTER (WHERE plan=\'pro\') as pro_count, COUNT(*) FILTER (WHERE plan=\'agency\') as agency_count FROM users GROUP BY plan'),
      pool.query('SELECT COUNT(*), status FROM scans GROUP BY status'),
      pool.query("SELECT COUNT(*) FROM scans WHERE created_at > NOW() - INTERVAL '24 hours'"),
    ]);
    res.json({ users: users.rows, scans: scans.rows, today_scans: todayScans.rows[0].count });
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/users', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id, email, full_name, plan, is_admin, created_at FROM users ORDER BY created_at DESC LIMIT 100');
    res.json({ users: rows });
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
