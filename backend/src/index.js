import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { authRouter } from './routes/auth.js';
import { scanRouter } from './routes/scan.js';
import { userRouter } from './routes/user.js';
import { subscriptionRouter } from './routes/subscription.js';
import { adminRouter } from './routes/admin.js';
import { badgeRouter } from './routes/badge.js';
import { pdfRouter } from './routes/pdf.js';
import { aiRouter } from './routes/ai.js';
import { leaderboardRouter } from './routes/leaderboard.js';

// Fail fast on missing required env vars
const REQUIRED_ENV = ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`FATAL: Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}
import { globalLimiter } from './middleware/rateLimit.js';
import { errorHandler } from './middleware/errorHandler.js';
import { initDB } from './models/db.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());
app.use(globalLimiter);

// Stripe webhook needs raw body
app.use('/api/subscription/webhook', express.raw({ type: 'application/json' }));

app.use('/api/auth', authRouter);
app.use('/api/scan', scanRouter);
app.use('/api/user', userRouter);
app.use('/api/subscription', subscriptionRouter);
app.use('/api/admin', adminRouter);
app.use('/api/badge', badgeRouter);
app.use('/api/pdf', pdfRouter);
app.use('/api/ai', aiRouter);
app.use('/api/leaderboard', leaderboardRouter);

app.get('/api/health', (req, res) => res.json({ status: 'ok', ts: Date.now() }));

app.use(errorHandler);

await initDB();
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
