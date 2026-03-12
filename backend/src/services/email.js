import nodemailer from 'nodemailer';

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

const FROM = process.env.SMTP_FROM || 'SecurityScan <noreply@securityscan.io>';
const BASE_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

function scoreColor(score) {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#f59e0b';
  if (score >= 40) return '#f97316';
  return '#ef4444';
}

function baseTemplate(content) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
        <!-- Header -->
        <tr><td style="background:#0f172a;border-radius:12px 12px 0 0;padding:24px 32px;">
          <span style="color:#6366f1;font-size:20px;font-weight:700;">SecurityScan</span>
          <span style="color:#94a3b8;font-size:12px;margin-left:8px;">Security Audit Platform</span>
        </td></tr>
        <!-- Content -->
        <tr><td style="background:#111;border:1px solid #222;border-top:none;border-radius:0 0 12px 12px;padding:32px;">
          ${content}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:24px 0;text-align:center;">
          <p style="color:#374151;font-size:12px;margin:0;">
            © 2025 SecurityScan · Non-intrusive security auditing only<br>
            <a href="${BASE_URL}/terms" style="color:#4b5563;">Terms</a> ·
            <a href="${BASE_URL}/privacy" style="color:#4b5563;">Privacy</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendVerificationEmail(email, fullName, token) {
  if (!process.env.SMTP_USER) return;
  const verifyUrl = `${BASE_URL}/auth/verify?token=${token}`;
  const html = baseTemplate(`
    <h2 style="color:#fff;margin:0 0 8px;">Verify your email</h2>
    <p style="color:#94a3b8;margin:0 0 24px;">Hi ${fullName}, confirm your email to activate your SecurityScan account.</p>
    <a href="${verifyUrl}" style="display:inline-block;background:#6366f1;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;">Verify Email Address</a>
    <p style="color:#4b5563;font-size:13px;margin:24px 0 0;">Or copy this link:<br><span style="color:#818cf8;">${verifyUrl}</span></p>
    <p style="color:#374151;font-size:12px;margin:16px 0 0;">This link expires in 24 hours.</p>
  `);
  await createTransport().sendMail({ from: FROM, to: email, subject: 'Verify your SecurityScan account', html });
}

export async function sendPasswordResetEmail(email, token) {
  if (!process.env.SMTP_USER) return;
  const resetUrl = `${BASE_URL}/auth/reset-password?token=${token}`;
  const html = baseTemplate(`
    <h2 style="color:#fff;margin:0 0 8px;">Reset your password</h2>
    <p style="color:#94a3b8;margin:0 0 24px;">We received a request to reset your password. Click the button below to create a new one.</p>
    <a href="${resetUrl}" style="display:inline-block;background:#6366f1;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;">Reset Password</a>
    <p style="color:#4b5563;font-size:13px;margin:24px 0 0;">Or copy this link:<br><span style="color:#818cf8;">${resetUrl}</span></p>
    <p style="color:#374151;font-size:12px;margin:16px 0 0;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
  `);
  await createTransport().sendMail({ from: FROM, to: email, subject: 'Reset your SecurityScan password', html });
}

export async function sendWelcomeEmail(email, fullName) {
  if (!process.env.SMTP_USER) return;
  const html = baseTemplate(`
    <h2 style="color:#fff;margin:0 0 8px;">Welcome to SecurityScan 🛡️</h2>
    <p style="color:#94a3b8;margin:0 0 16px;">Hi ${fullName}, your account is ready. Start scanning your websites for security issues.</p>
    <div style="background:#0a0a0a;border:1px solid #222;border-radius:10px;padding:20px;margin:0 0 24px;">
      <p style="color:#94a3b8;margin:0 0 8px;font-size:13px;">Your free plan includes:</p>
      <p style="color:#22c55e;margin:4px 0;font-size:14px;">✓ 3 scans per month</p>
      <p style="color:#22c55e;margin:4px 0;font-size:14px;">✓ Full security report</p>
      <p style="color:#22c55e;margin:4px 0;font-size:14px;">✓ Fix recommendations</p>
    </div>
    <a href="${BASE_URL}" style="display:inline-block;background:#6366f1;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;">Scan Your First Domain</a>
  `);
  await createTransport().sendMail({ from: FROM, to: email, subject: 'Welcome to SecurityScan!', html });
}

export async function sendMonitoringAlert(email, domain, score, prevScore, criticals, scanId) {
  if (!process.env.SMTP_USER) return;
  const scoreDiff = score - prevScore;
  const direction = scoreDiff >= 0 ? `+${scoreDiff}` : `${scoreDiff}`;
  const color = scoreColor(score);
  const reportUrl = `${BASE_URL}/scan/${scanId}`;
  const html = baseTemplate(`
    <h2 style="color:#fff;margin:0 0 8px;">Security scan complete — ${domain}</h2>
    <p style="color:#94a3b8;margin:0 0 24px;">Your scheduled security scan has finished. Here's what we found.</p>
    <div style="text-align:center;margin:0 0 24px;">
      <div style="font-size:56px;font-weight:700;color:${color};">${score}</div>
      <div style="color:#6b7280;font-size:14px;">Security Score / 100</div>
      ${prevScore ? `<div style="color:${scoreDiff >= 0 ? '#22c55e' : '#ef4444'};font-size:14px;margin-top:4px;">${direction} from last scan</div>` : ''}
    </div>
    ${criticals > 0 ? `<div style="background:#ef444410;border:1px solid #ef444430;border-radius:8px;padding:12px 16px;margin:0 0 24px;color:#ef4444;font-size:14px;">⚠️ ${criticals} critical or high severity issue${criticals !== 1 ? 's' : ''} found</div>` : '<div style="background:#22c55e10;border:1px solid #22c55e30;border-radius:8px;padding:12px 16px;margin:0 0 24px;color:#22c55e;font-size:14px;">✓ No critical issues found</div>'}
    <a href="${reportUrl}" style="display:inline-block;background:#6366f1;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;">View Full Report</a>
  `);
  const subject = score < 60
    ? `⚠️ Security Alert: ${domain} scored ${score}/100`
    : `✓ Security Scan Complete: ${domain} scored ${score}/100`;
  await createTransport().sendMail({ from: FROM, to: email, subject, html });
}
