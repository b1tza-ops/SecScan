import { Router } from 'express';
import OpenAI from 'openai';
import { body, validationResult } from 'express-validator';
import { pool } from '../models/db.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';

export const aiRouter = Router();

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many AI requests. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});

function getClient() {
  if (!process.env.OPENAI_API_KEY) throw new Error('OpenAI API key not configured');
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// POST /api/ai/fix — AI-powered fix recommendation for a specific finding
aiRouter.post('/fix', aiLimiter, optionalAuth, [
  body('title').notEmpty().isString().isLength({ max: 200 }),
  body('description').isString().isLength({ max: 1000 }),
  body('severity').isIn(['critical', 'high', 'medium', 'low', 'info']),
  body('category').optional().isString().isLength({ max: 100 }),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    // Pro/Agency users get unlimited AI fixes; free/anon get 3/day
    if (!req.user || req.user.plan === 'free') {
      const key = req.user ? `ai-fix-user-${req.user.id}` : `ai-fix-ip-${req.ip}`;
      const { rows } = await pool.query(
        `SELECT COUNT(*) FROM ai_usage WHERE usage_key=$1 AND created_at > NOW() - INTERVAL '1 day'`,
        [key]
      ).catch(() => ({ rows: [{ count: 0 }] }));
      if (parseInt(rows[0].count) >= 3) {
        return res.status(429).json({ error: 'Daily AI fix limit reached (3/day on free plan). Upgrade to Pro for unlimited.' });
      }
      await pool.query('INSERT INTO ai_usage (usage_key) VALUES ($1)', [key]).catch(() => {});
    }

    const { title, description, severity, category } = req.body;
    const openai = getClient();

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a cybersecurity expert specializing in web application security.
Provide concise, actionable fix advice for security vulnerabilities.
Format your response as JSON with these fields:
- summary: 1-2 sentence plain-English explanation of the issue
- steps: array of 3-5 specific actionable steps to fix the issue
- code_example: a short code snippet or configuration example (if applicable, otherwise null)
- references: array of 1-3 relevant URLs for further reading (OWASP, MDN, official docs)
- estimated_effort: "low" | "medium" | "high"`,
        },
        {
          role: 'user',
          content: `Security finding to fix:
Title: ${title}
Severity: ${severity}
Category: ${category || 'unknown'}
Description: ${description}

Provide specific, practical remediation advice.`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 600,
      temperature: 0.3,
    });

    const advice = JSON.parse(completion.choices[0].message.content);
    res.json({ advice });
  } catch (err) {
    if (err.message === 'OpenAI API key not configured') {
      return res.status(503).json({ error: 'AI service not configured' });
    }
    next(err);
  }
});

// POST /api/ai/summary — generate executive summary for a completed scan
aiRouter.post('/summary', aiLimiter, requireAuth, [
  body('scanId').isUUID(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { rows: scanRows } = await pool.query(
      'SELECT * FROM scans WHERE id=$1 AND user_id=$2',
      [req.body.scanId, req.user.id]
    );
    if (!scanRows.length) return res.status(404).json({ error: 'Scan not found' });
    const scan = scanRows[0];
    if (scan.status !== 'completed') return res.status(400).json({ error: 'Scan not yet complete' });

    const { rows: vulns } = await pool.query(
      `SELECT title, severity, category FROM vulnerabilities WHERE scan_id=$1 ORDER BY severity LIMIT 20`,
      [scan.id]
    );

    const openai = getClient();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a security consultant writing an executive summary for a non-technical audience.
Be clear, concise, and prioritize business impact. Respond as JSON with:
- overall_assessment: 2-3 sentence summary of the security posture
- top_risks: array of 2-3 most critical business risks
- quick_wins: array of 2-3 easiest fixes to implement immediately
- priority_level: "critical" | "high" | "medium" | "low"`,
        },
        {
          role: 'user',
          content: `Security scan results for ${scan.domain}:
Score: ${scan.security_score}/100
Critical & High: ${scan.critical_count}
Warnings: ${scan.warning_count}
Info: ${scan.info_count}

Top findings:
${vulns.map(v => `- [${v.severity.toUpperCase()}] ${v.title}`).join('\n')}

Write an executive summary.`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 500,
      temperature: 0.4,
    });

    const summary = JSON.parse(completion.choices[0].message.content);
    res.json({ summary, domain: scan.domain, score: scan.security_score });
  } catch (err) {
    if (err.message === 'OpenAI API key not configured') {
      return res.status(503).json({ error: 'AI service not configured' });
    }
    next(err);
  }
});
