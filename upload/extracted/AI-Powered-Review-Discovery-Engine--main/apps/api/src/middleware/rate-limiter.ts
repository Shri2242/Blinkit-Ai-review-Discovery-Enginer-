/* eslint-disable @typescript-eslint/no-explicit-any */
import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

import { logger } from './request-logger.js';
import { redis } from '../lib/redis.js';

// Helper to create a new RedisStore instance for each limiter (required to prevent store reuse error)
// Falls back to memory store if Redis is unavailable
function createRedisStore(prefix: string) {
  if (!redis) {
    logger.warn({ prefix }, 'Redis unavailable for rate limiting, using memory store');
    return undefined;
  }
  try {
    return new RedisStore({
      prefix: `rl:${prefix}:`,
      sendCommand: async (...args: string[]) => {
        const command = args[0] as string;
        const commandArgs = args.slice(1);
        return (await redis.call(command, ...commandArgs)) as any;
      },
    });
  } catch (err) {
    logger.warn(
      { err, prefix },
      'Failed to create Redis store for rate limiting, using memory store'
    );
    return undefined;
  }
}

// a) Global rate limiter: 100 requests per minute per IP
export const globalRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: 'Too many requests. Please try again later.',
  handler: (_req, res, _next, options) => {
    res.status(options.statusCode).json({
      success: false,
      error: {
        code: 'RATE_LIMIT',
        message: options.message,
      },
    });
  },
  store: createRedisStore('global'),
});

// b) Auth-specific rate limiter: 10 requests per minute per IP
export const authRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: 'Too many login or registration attempts. Please try again in a minute.',
  handler: (_req, res, _next, options) => {
    res.status(options.statusCode).json({
      success: false,
      error: {
        code: 'RATE_LIMIT',
        message: options.message,
      },
    });
  },
  store: createRedisStore('auth'),
});

// c) Upload rate limiter: 5 uploads per hour per IP
export const uploadRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: 'Upload limit reached. You can only upload 5 files per hour.',
  handler: (_req, res, _next, options) => {
    res.status(options.statusCode).json({
      success: false,
      error: {
        code: 'RATE_LIMIT',
        message: options.message,
      },
    });
  },
  store: createRedisStore('upload'),
});

// d) Chat rate limiter: 30 messages per hour per user (or IP if unauthenticated)
export const chatRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => {
    return (req as any).user?.id || req.ip || 'unknown-ip';
  },
  message: 'Chat message limit reached. You can only send 30 messages per hour.',
  handler: (_req, res, _next, options) => {
    res.status(options.statusCode).json({
      success: false,
      error: {
        code: 'RATE_LIMIT',
        message: options.message,
      },
    });
  },
  store: createRedisStore('chat'),
});
