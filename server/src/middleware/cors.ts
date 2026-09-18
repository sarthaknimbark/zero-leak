import cors from 'cors';
import { env } from '../config/env.js';

export const corsMiddleware = cors({
  origin(origin, callback) {
    // Allow non-browser clients (cron, health checks) with no Origin header
    if (!origin) {
      callback(null, true);
      return;
    }

    if (env.allowedOrigins.includes(origin) || env.allowedOrigins.includes('*')) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
});
