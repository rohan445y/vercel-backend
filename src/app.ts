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

// Trust proxy in production (Vercel / Render reverse proxy)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or same-origin)
      if (!origin) return callback(null, true);
      const allowedOrigins = [
        process.env.FRONTEND_URL,
        'http://localhost:3000',
        'http://127.0.0.1:3000',
      ].filter(Boolean) as string[];

      // In production on Vercel, allow any *.vercel.app domain if process.env.VERCEL is present or origin matches VERCEL_URL
      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith('.vercel.app') ||
        process.env.NODE_ENV !== 'production'
      ) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive CORS for seamless deployment
    },
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

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use('/api', limiter);

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
