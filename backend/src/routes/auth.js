import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { body, validationResult } from 'express-validator';
import { pool } from '../models/db.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail } from '../services/email.js';

export const authRouter = Router();

const validateRegister = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('full_name').trim().notEmpty(),
];

authRouter.post('/register', authLimiter, validateRegister, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password, full_name } = req.body;
    const password_hash = await bcrypt.hash(password, 12);

    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const { rows } = await pool.query(
      'INSERT INTO users (email, password_hash, full_name, verify_token, verify_token_expires) VALUES ($1,$2,$3,$4,$5) RETURNING id, email, plan, full_name',
      [email, password_hash, full_name, verifyToken, verifyExpires]
    );

    sendVerificationEmail(email, full_name, verifyToken).catch(() => {});
    sendWelcomeEmail(email, full_name).catch(() => {});

    const token = jwt.sign({ userId: rows[0].id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, secure: process.env.COOKIE_SECURE === 'true', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.status(201).json({ user: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    next(err);
  }
});

authRouter.post('/login', authLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    const { rows } = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    if (!rows.length || !(await bcrypt.compare(password, rows[0].password_hash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: rows[0].id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, secure: process.env.COOKIE_SECURE === 'true', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ user: { id: rows[0].id, email: rows[0].email, plan: rows[0].plan, full_name: rows[0].full_name } });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

authRouter.get('/verify-email', async (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Missing token' });
    const { rows } = await pool.query(
      'UPDATE users SET email_verified=true, verify_token=NULL, verify_token_expires=NULL WHERE verify_token=$1 AND verify_token_expires > NOW() RETURNING id',
      [token]
    );
    if (!rows.length) return res.status(400).json({ error: 'Invalid or expired verification link' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/forgot-password', authLimiter, [body('email').isEmail().normalizeEmail()], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { email } = req.body;
    // Always return success to prevent user enumeration
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    const { rowCount } = await pool.query(
      'UPDATE users SET reset_token=$1, reset_token_expires=$2 WHERE email=$3',
      [resetToken, resetExpires, email]
    );
    if (rowCount > 0) {
      sendPasswordResetEmail(email, resetToken).catch(() => {});
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/reset-password', authLimiter, [
  body('token').notEmpty(),
  body('password').isLength({ min: 8 }),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { token, password } = req.body;
    const password_hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      'UPDATE users SET password_hash=$1, reset_token=NULL, reset_token_expires=NULL WHERE reset_token=$2 AND reset_token_expires > NOW() RETURNING id',
      [password_hash, token]
    );
    if (!rows.length) return res.status(400).json({ error: 'Invalid or expired reset link' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', async (req, res, next) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Not authenticated' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await pool.query('SELECT id, email, plan, full_name, api_key, is_admin FROM users WHERE id=$1', [decoded.userId]);
    if (!rows.length) return res.status(401).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});
