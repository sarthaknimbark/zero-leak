import { Router } from 'express';
import { checkDatabaseConnection } from '../lib/startup.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const healthRouter = Router();

healthRouter.get(
  '/health',
  asyncHandler(async (_req, res) => {
    const status = await checkDatabaseConnection();
    const ok = status.database === 'connected';

    res.status(ok ? 200 : 503).json({
      ok,
      service: 'zero-leak-server',
      server: 'connected',
      database: status.database,
      supabaseHost: status.supabaseHost,
      ...(status.databaseMessage ? { databaseMessage: status.databaseMessage } : {}),
      timestamp: new Date().toISOString(),
    });
  })
);
