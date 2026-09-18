import type { RequestHandler } from 'express';
import { ZodError, type ZodSchema } from 'zod';
import { AppError } from '../utils/errors.js';

export function validateBody<T>(schema: ZodSchema<T>): RequestHandler {
  return (req, _res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(new AppError(400, 'Validation failed', err.flatten()));
        return;
      }
      next(err);
    }
  };
}
