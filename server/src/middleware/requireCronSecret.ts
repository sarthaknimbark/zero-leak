import type { RequestHandler } from 'express';
import { env } from '../config/env.js';

/** Protects internal cron/job endpoints. */
export const requireCronSecret: RequestHandler = (req, res, next) => {
  if (!env.cronSecret) {
    res.status(503).json({ error: 'CRON_SECRET is not configured on the server' });
    return;
  }

  const header = req.header('x-cron-secret') ?? req.header('authorization');
  const token =
    header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : header?.trim();

  if (!token || token !== env.cronSecret) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
};
