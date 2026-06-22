/* eslint-disable @typescript-eslint/no-namespace */
import { and, eq } from 'drizzle-orm';
import { Request, Response, NextFunction } from 'express';

import { db, projectMembers } from '@review-engine/database';
import { UserRole } from '@review-engine/shared';

import { NotFoundError, ForbiddenError } from '../lib/errors.js';

declare global {
  namespace Express {
    interface Request {
      projectRole?: UserRole;
    }
  }
}

export function requireProjectAccess(allowedRoles?: UserRole[]) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const projectId = (req.params['projectId'] || req.params['id']) as string;
      if (!projectId) {
        throw new NotFoundError('Project ID required');
      }

      // Look up project_members record
      const [membership] = await db
        .select()
        .from(projectMembers)
        .where(
          and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, req.user!.userId))
        )
        .limit(1);

      if (!membership) {
        // Don't reveal that the project exists — return same error as "not found"
        throw new NotFoundError('Project not found');
      }

      const memberRole = membership.role as UserRole;
      req.projectRole = memberRole;

      if (allowedRoles && !allowedRoles.includes(memberRole)) {
        throw new ForbiddenError('Insufficient permissions for this project');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
