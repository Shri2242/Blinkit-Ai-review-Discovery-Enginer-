import { NextFunction, Request, Response } from 'express';

import * as embeddingService from './embedding.service.js';
import { ValidationError } from '../../lib/errors.js';
import { sendSuccess } from '../../lib/response.js';

/**
 * Handles POST /projects/:projectId/embeddings/generate
 */
export async function generate(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = req.params['projectId'] as string;
    const batchSize = req.body.batchSize !== undefined ? Number(req.body.batchSize) : undefined;

    if (batchSize !== undefined && (isNaN(batchSize) || batchSize <= 0)) {
      throw new ValidationError('Invalid batchSize. Must be a positive integer.');
    }

    const result = await embeddingService.generateEmbeddings(projectId, batchSize);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

/**
 * Handles POST /projects/:projectId/embeddings/search
 */
export async function search(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = req.params['projectId'] as string;
    const { query, limit } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new ValidationError('Query is required and must be a non-empty string.');
    }

    if (query.length > 1000) {
      throw new ValidationError('Query must be 1000 characters or less.');
    }

    const limitNum = limit !== undefined ? Number(limit) : undefined;
    if (limitNum !== undefined && (isNaN(limitNum) || limitNum <= 0)) {
      throw new ValidationError('Invalid limit. Must be a positive integer.');
    }

    const result = await embeddingService.semanticSearch(projectId, query.trim(), limitNum);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

/**
 * Handles GET /projects/:projectId/embeddings/stats
 */
export async function getStats(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = req.params['projectId'] as string;
    const result = await embeddingService.getEmbeddingStats(projectId);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}
