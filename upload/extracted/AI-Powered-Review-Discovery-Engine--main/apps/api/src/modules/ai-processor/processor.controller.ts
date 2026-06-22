import { NextFunction, Request, Response } from 'express';

import * as processorService from './processor.service.js';
import { ValidationError } from '../../lib/errors.js';
import { sendSuccess } from '../../lib/response.js';

/**
 * Handles POST /projects/:projectId/ai/process
 */
export async function processReviews(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = req.params['projectId'] as string;
    const batchSize = req.body.batchSize !== undefined ? Number(req.body.batchSize) : undefined;

    if (batchSize !== undefined && (isNaN(batchSize) || batchSize <= 0)) {
      throw new ValidationError('Invalid batchSize. Must be a positive integer.');
    }

    const result = await processorService.processUnprocessedReviews(projectId, batchSize);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

/**
 * Handles GET /projects/:projectId/ai/stats
 */
export async function getStats(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = req.params['projectId'] as string;
    const result = await processorService.getProcessingStats(projectId);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

/**
 * Handles GET /projects/:projectId/ai/reviews
 */
export async function getFilteredReviews(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = req.params['projectId'] as string;
    const theme = req.query['theme'] as string | undefined;
    const priority = req.query['priority'] as string | undefined;
    const sentiment = req.query['sentiment'] as string | undefined;
    const source = req.query['source'] as string | undefined;

    const isBug =
      req.query['isBug'] === 'true' || req.query['is_bug'] === 'true' ? true : undefined;
    const isFeatureRequest =
      req.query['isFeatureRequest'] === 'true' || req.query['is_feature_request'] === 'true'
        ? true
        : undefined;

    const limit = req.query['limit'] !== undefined ? Number(req.query['limit']) : undefined;
    const offset = req.query['offset'] !== undefined ? Number(req.query['offset']) : undefined;
    const sortBy = req.query['sortBy'] as 'newest' | 'oldest' | 'priority' | 'rating' | undefined;

    if (limit !== undefined && (isNaN(limit) || limit <= 0)) {
      throw new ValidationError('Invalid limit. Must be a positive integer.');
    }
    if (offset !== undefined && (isNaN(offset) || offset < 0)) {
      throw new ValidationError('Invalid offset. Must be a non-negative integer.');
    }

    const result = await processorService.getReviewsAdvanced(projectId, {
      theme,
      priority,
      sentiment,
      source,
      isBug,
      isFeatureRequest,
      limit,
      offset,
      sortBy,
    });

    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}
