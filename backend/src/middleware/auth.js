import jwt from 'jsonwebtoken';
import { pool } from '../models/db.js';

const USER_FIELDS = 'id, email, plan, is_admin, full_name';

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = req.cookies?.token || (authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null);
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    // Try JWT first
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const { rows } = await pool.query(`SELECT ${USER_FIELDS} FROM users WHERE id = $1`, [decoded.userId]);
      if (!rows.length) return res.status(401).json({ error: 'User not found' });
      req.user = rows[0];
      return next();
    } catch {
      // Not a valid JWT — try as API key (Agency plan feature)
      const { rows } = await pool.query(`SELECT ${USER_FIELDS} FROM users WHERE api_key = $1 AND plan = 'agency'`, [token]);
      if (!rows.length) return res.status(401).json({ error: 'Invalid token or API key' });
      req.user = rows[0];
      return next();
    }
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user?.is_admin) return res.status(403).json({ error: 'Forbidden' });
  next();
}

export async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = req.cookies?.token || (authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null);
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { rows } = await pool.query(`SELECT ${USER_FIELDS} FROM users WHERE id = $1`, [decoded.userId]);
        if (rows.length) req.user = rows[0];
      } catch {
        // Try as API key
        const { rows } = await pool.query(`SELECT ${USER_FIELDS} FROM users WHERE api_key = $1`, [token]);
        if (rows.length) req.user = rows[0];
      }
    }
  } catch {}
  next();
}
