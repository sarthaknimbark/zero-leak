import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError } from '../utils/errors.js';
import { env } from '../config/env.js';

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'Not found' });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    });
    return;
  }

  const message = err instanceof Error ? err.message : 'Internal server error';
  const isCors = message.startsWith('CORS blocked');

  if (isCors) {
    res.status(403).json({ error: message });
    return;
  }

  console.error(err);
  res.status(500).json({
    error: env.isProd ? 'Internal server error' : message,
  });
};
