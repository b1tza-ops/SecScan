import { Router } from 'express';
import { pool } from '../models/db.js';

export const badgeRouter = Router();

// GET /api/badge/:domain — returns an SVG security score badge
badgeRouter.get('/:domain', async (req, res, next) => {
  try {
    const domain = req.params.domain
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .trim();

    const { rows } = await pool.query(
      `SELECT security_score FROM scans
       WHERE domain=$1 AND status='completed'
       ORDER BY created_at DESC LIMIT 1`,
      [domain]
    );

    let score = null;
    let color = '#6b7280';
    let rightText = 'unscanned';

    if (rows.length && rows[0].security_score !== null) {
      score = rows[0].security_score;
      rightText = `${score}/100`;
      if (score >= 80) color = '#22c55e';
      else if (score >= 60) color = '#f59e0b';
      else if (score >= 40) color = '#f97316';
      else color = '#ef4444';
    }

    const leftText = 'SecurityScan';
    const charWidth = 6.5;
    const leftWidth = Math.ceil(leftText.length * charWidth) + 20;
    const rightWidth = Math.ceil(rightText.length * charWidth) + 20;
    const totalWidth = leftWidth + rightWidth;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="SecurityScan: ${rightText}">
  <title>SecurityScan: ${rightText}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${leftWidth}" height="20" fill="#1e293b"/>
    <rect x="${leftWidth}" width="${rightWidth}" height="20" fill="${color}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
    <text x="${leftWidth / 2}" y="15" fill="#010101" fill-opacity=".25">${leftText}</text>
    <text x="${leftWidth / 2}" y="14">${leftText}</text>
    <text x="${leftWidth + rightWidth / 2}" y="15" fill="#010101" fill-opacity=".25">${rightText}</text>
    <text x="${leftWidth + rightWidth / 2}" y="14">${rightText}</text>
  </g>
</svg>`;

    res.set({
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'no-cache, max-age=0',
      'ETag': `${domain}-${score}`,
    });
    res.send(svg);
  } catch (err) {
    next(err);
  }
});
