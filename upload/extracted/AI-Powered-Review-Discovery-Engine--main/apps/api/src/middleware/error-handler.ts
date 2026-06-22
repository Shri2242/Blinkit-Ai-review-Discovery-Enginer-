/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

import { logger } from './request-logger.js';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): Response | void {
  if (res.headersSent) {
    return next(err);
  }
  // 1. Zod validation errors
  if (err instanceof ZodError) {
    return res.status(422).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: err.errors.map((e) => ({
          field: e.path.join('.'),
          issue: e.message,
        })),
      },
    });
  }

  // 2. Custom AppError
  if (err && typeof err.statusCode === 'number' && typeof err.code === 'string') {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    });
  }

  // 3. JWT specific errors
  if (err && err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token',
      },
    });
  }

  if (err && err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: {
        code: 'TOKEN_EXPIRED',
        message: 'Token has expired',
      },
    });
  }

  // 4. Database errors — never leak schema info
  const reqId = req.id || 'N/A';
  if (err && err.code && ['23505', '23503', '23502', '42P01', '42703'].includes(err.code)) {
    logger.error({ request_id: reqId, err: { message: err.message } }, 'Database error');
    return res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'A database error occurred',
      },
    });
  }

  // 5. Default 500 error handler — no stack traces in production
  const isProduction = process.env['NODE_ENV'] === 'production';
  logger.error(
    {
      request_id: reqId,
      err: {
        message: err.message || String(err),
        stack: err.stack,
      },
    },
    'An unhandled exception occurred'
  );

  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: isProduction ? 'An unexpected error occurred' : err.message,
      ...(isProduction ? {} : { stack: err.stack }),
    },
  });
}
