/* eslint-disable @typescript-eslint/no-namespace, @typescript-eslint/no-explicit-any */
import { eq } from 'drizzle-orm';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

import { db, users } from '@review-engine/database';
import { env, UserRole } from '@review-engine/shared';

import { UnauthorizedError, ForbiddenError } from '../lib/errors.js';
import { redis } from '../lib/redis.js';
import * as apikeyService from '../modules/apikeys/apikey.service.js';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: UserRole;
      };
      apiKey?: {
        keyId: string;
        projectId: string;
        userId: string;
        scopes: string[];
      };
    }
  }
}

export async function authenticateApiKey(req: Request, _res: Response, next: NextFunction) {
  try {
    const rawKey = req.headers['x-api-key'] as string | undefined;
    if (rawKey) {
      const validated = await apikeyService.validateKey(rawKey);
      if (!validated) {
        throw new UnauthorizedError('Invalid or revoked API key');
      }
      req.apiKey = {
        keyId: validated.keyId,
        projectId: validated.projectId,
        userId: validated.userId,
        scopes: validated.scopes,
      };
    }
    next();
  } catch (error) {
    next(error);
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    if (token) {
      // Check Redis blacklist
      let isBlacklisted = false;
      try {
        const blacklistedVal = await redis.get(`blacklist:${token}`);
        if (blacklistedVal) {
          isBlacklisted = true;
        }
      } catch (err) {
        console.warn(
          'Redis unavailable for token blacklist check, proceeding with JWT validation only:',
          (err as Error).message
        );
      }

      if (isBlacklisted) {
        throw new UnauthorizedError('Token has been revoked');
      }

      let decoded: any;
      try {
        decoded = jwt.verify(token, env.JWT_SECRET);
      } catch (err: any) {
        if (err.name === 'TokenExpiredError') {
          throw new UnauthorizedError('Token has expired');
        }
        if (err.name === 'JsonWebTokenError') {
          throw new UnauthorizedError('Invalid token');
        }
        if (err.name === 'NotBeforeError') {
          throw new UnauthorizedError('Token not yet valid');
        }
        throw new UnauthorizedError('Invalid or expired token');
      }

      req.user = {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
      };

      return next();
    }

    // Check for X-API-Key if no Bearer token
    const rawKey = req.headers['x-api-key'] as string | undefined;
    if (rawKey) {
      const validated = await apikeyService.validateKey(rawKey);
      if (!validated) {
        throw new UnauthorizedError('Invalid or revoked API key');
      }

      // Look up user details to populate req.user fully
      const [user] = await db.select().from(users).where(eq(users.id, validated.userId)).limit(1);

      if (!user) {
        throw new UnauthorizedError('User associated with API key not found');
      }

      req.apiKey = {
        keyId: validated.keyId,
        projectId: validated.projectId,
        userId: validated.userId,
        scopes: validated.scopes,
      };

      req.user = {
        userId: user.id,
        email: user.email,
        role: user.role as UserRole,
      };

      return next();
    }

    throw new UnauthorizedError('Authentication required');
  } catch (error) {
    next(error);
  }
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      if (!allowedRoles.includes(req.user.role)) {
        throw new ForbiddenError(
          `Insufficient permissions. Required role: ${allowedRoles.join(' or ')}`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
