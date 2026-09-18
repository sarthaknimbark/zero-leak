import cors from 'cors';
import { env } from '../config/env.js';

function isVercelOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === 'vercel.app' || host.endsWith('.vercel.app');
  } catch {
    return false;
  }
}

function originAllowed(origin: string): boolean {
  const allowed = env.allowedOrigins;
  if (allowed.includes('*')) return true;
  if (allowed.includes(origin)) return true;

  // Always allow Vercel frontends (production + preview deployments)
  if (isVercelOrigin(origin)) return true;

  // Explicit wildcard entries still supported
  if (allowed.some((entry) => entry === 'https://*.vercel.app' || entry === '*.vercel.app')) {
    return isVercelOrigin(origin);
  }

  return false;
}

export const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (originAllowed(origin)) {
      callback(null, true);
      return;
    }

    console.warn(`CORS blocked origin: ${origin}`);
    // Do not throw — throwing becomes 403 without CORS headers and confuses browsers
    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-cron-secret'],
  optionsSuccessStatus: 204,
});
