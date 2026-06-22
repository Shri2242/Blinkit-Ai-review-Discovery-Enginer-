import { NextFunction, Request, Response } from 'express';

import * as insightsService from './insights.service.js';
import { ValidationError } from '../../lib/errors.js';
import { sendSuccess } from '../../lib/response.js';

/**
 * Handles GET /projects/:projectId/insights/overview
 */
export async function getOverview(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = req.params['projectId'] as string;
    const result = await insightsService.getDashboardOverview(projectId);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

/**
 * Handles GET /projects/:projectId/insights/sentiment-trend
 */
export async function getSentimentTrend(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = req.params['projectId'] as string;
    const days = req.query['days'] !== undefined ? Number(req.query['days']) : undefined;

    if (days !== undefined && (isNaN(days) || days <= 0)) {
      throw new ValidationError('Invalid days parameter. Must be a positive integer.');
    }

    const result = await insightsService.getSentimentTrend(projectId, days);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

/**
 * Handles GET /projects/:projectId/insights/theme-trend
 */
export async function getThemeTrend(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = req.params['projectId'] as string;
    const days = req.query['days'] !== undefined ? Number(req.query['days']) : undefined;

    if (days !== undefined && (isNaN(days) || days <= 0)) {
      throw new ValidationError('Invalid days parameter. Must be a positive integer.');
    }

    const result = await insightsService.getThemeTrend(projectId, days);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

/**
 * Handles GET /projects/:projectId/insights/top-issues
 */
export async function getTopIssues(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = req.params['projectId'] as string;
    const limit = req.query['limit'] !== undefined ? Number(req.query['limit']) : undefined;

    if (limit !== undefined && (isNaN(limit) || limit <= 0)) {
      throw new ValidationError('Invalid limit parameter. Must be a positive integer.');
    }

    const result = await insightsService.getTopIssues(projectId, limit);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

/**
 * Handles GET /projects/:projectId/insights/sources
 */
export async function getSources(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = req.params['projectId'] as string;
    const result = await insightsService.getReviewVolumeBySource(projectId);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

/**
 * Handles POST /projects/:projectId/insights/weekly-summary
 */
export async function generateWeeklySummary(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = req.params['projectId'] as string;
    const result = await insightsService.generateWeeklySummary(projectId);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}
