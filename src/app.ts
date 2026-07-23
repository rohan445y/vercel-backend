import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { errorHandler } from './middleware/validate';

import authRoutes from './routes/auth';
import dashboardRoutes from './routes/dashboard';
import subscriptionRoutes from './routes/subscription';
import adminRoutes from './routes/admin';
import publicRoutes from './routes/public';
import supportRoutes from './routes/support';

dotenv.config();

const app = express();

// Trust proxy for Render/Vercel reverse proxies
app.set('trust proxy', true);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static uploads if directory exists
try {
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
} catch {
  // Ignore in serverless if directory doesn't exist
}

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  validate: { trustProxy: false },
});
app.use('/api', limiter);

app.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'KARMA API root is reachable. Use /api/health to check service status.',
  });
});

app.get('/api', (_req, res) => {
  res.json({ success: true, message: 'KARMA API is running' });
});

app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'KARMA API is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/support', supportRoutes);

app.use(errorHandler);

export default app;
