import cors from 'cors';
import { env } from '../config/env.js';

function originAllowed(origin: string): boolean {
  const allowed = env.allowedOrigins;
  if (allowed.includes('*')) return true;
  if (allowed.includes(origin)) return true;

  // Support https://*.vercel.app in ALLOWED_ORIGINS
  if (allowed.some((entry) => entry === 'https://*.vercel.app' || entry === '*.vercel.app')) {
    try {
      const host = new URL(origin).hostname;
      return host === 'vercel.app' || host.endsWith('.vercel.app');
    } catch {
      return false;
    }
  }

  return false;
}

export const corsMiddleware = cors({
  origin(origin, callback) {
    // Allow non-browser clients (cron, health checks) with no Origin header
    if (!origin) {
      callback(null, true);
      return;
    }

    if (originAllowed(origin)) {
      callback(null, true);
      return;
    }

    console.warn(`CORS blocked origin: ${origin}`);
    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-cron-secret'],
  optionsSuccessStatus: 204,
});
