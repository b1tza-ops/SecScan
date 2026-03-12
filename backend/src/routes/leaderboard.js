import { Router } from 'express';
import { pool } from '../models/db.js';
import { globalLimiter } from '../middleware/rateLimit.js';

export const leaderboardRouter = Router();
leaderboardRouter.use(globalLimiter);

// GET /api/leaderboard — top scored domains (public)
leaderboardRouter.get('/', async (req, res, next) => {
  try {
    const { rows: top } = await pool.query(`
      SELECT DISTINCT ON (domain)
        domain, security_score, critical_count, warning_count, completed_at
      FROM scans
      WHERE status = 'completed'
        AND security_score IS NOT NULL
        AND domain NOT IN ('localhost', '127.0.0.1', 'example.com')
      ORDER BY domain, completed_at DESC
    `);

    // Sort: best scores first
    const best = [...top].sort((a, b) => b.security_score - a.security_score).slice(0, 20);
    const worst = [...top].sort((a, b) => a.security_score - b.security_score).slice(0, 10);

    res.json({ best, worst, total: top.length });
  } catch (err) {
    next(err);
  }
});
