import { NextFunction, Request, Response } from 'express';

import * as ragService from './rag.service.js';
import { ValidationError } from '../../lib/errors.js';
import { sendSuccess } from '../../lib/response.js';

/**
 * Handles POST /projects/:projectId/chat
 */
export async function chat(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = req.params['projectId'] as string;
    const userId = req.user!.userId;
    const { question } = req.body;

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      throw new ValidationError('Question is required and must be a non-empty string.');
    }

    if (question.length > 2000) {
      throw new ValidationError('Question must be 2000 characters or less.');
    }

    const result = await ragService.chat(projectId, userId, question.trim());
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

/**
 * Handles GET /projects/:projectId/chat/history
 */
export async function getHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = req.params['projectId'] as string;
    const userId = req.user!.userId;
    const limit = req.query['limit'] !== undefined ? Number(req.query['limit']) : undefined;

    if (limit !== undefined && (isNaN(limit) || limit <= 0)) {
      throw new ValidationError('Invalid limit. Must be a positive integer.');
    }

    const result = await ragService.getChatHistory(projectId, userId, limit);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

/**
 * Handles GET /projects/:projectId/chat/stats
 */
export async function getStats(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = req.params['projectId'] as string;
    const result = await ragService.getProjectChatStats(projectId);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}
