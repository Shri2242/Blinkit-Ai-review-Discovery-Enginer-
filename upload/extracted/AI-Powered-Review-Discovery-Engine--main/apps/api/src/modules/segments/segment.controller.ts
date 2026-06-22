import type { Request, Response } from 'express';

import { segmentService } from './segment.service.js';
import { AppError } from '../../lib/errors.js';
import { sendSuccess, sendError } from '../../lib/response.js';

function handleError(res: Response, err: unknown, fallbackCode = 'SEGMENTS_FAILED') {
  if (err instanceof AppError) {
    return sendError(res, err);
  }
  return sendError(res, new AppError(500, fallbackCode, (err as Error).message));
}

export const segmentController = {
  async getSummary(req: Request, res: Response) {
    try {
      const projectId = req.params['projectId'] as string;
      const data = await segmentService.getSegmentSummary(projectId);
      return sendSuccess(res, data);
    } catch (err) {
      return handleError(res, err);
    }
  },
  async getByRating(req: Request, res: Response) {
    try {
      const projectId = req.params['projectId'] as string;
      const data = await segmentService.getByRating(projectId);
      return sendSuccess(res, data);
    } catch (err) {
      return handleError(res, err);
    }
  },
  async getBySource(req: Request, res: Response) {
    try {
      const projectId = req.params['projectId'] as string;
      const data = await segmentService.getBySource(projectId);
      return sendSuccess(res, data);
    } catch (err) {
      return handleError(res, err);
    }
  },
  async getBySentiment(req: Request, res: Response) {
    try {
      const projectId = req.params['projectId'] as string;
      const data = await segmentService.getBySentiment(projectId);
      return sendSuccess(res, data);
    } catch (err) {
      return handleError(res, err);
    }
  },
  async getByTheme(req: Request, res: Response) {
    try {
      const projectId = req.params['projectId'] as string;
      const data = await segmentService.getByTheme(projectId);
      return sendSuccess(res, data);
    } catch (err) {
      return handleError(res, err);
    }
  },
  async getThemeByRating(req: Request, res: Response) {
    try {
      const projectId = req.params['projectId'] as string;
      const data = await segmentService.getThemeByRating(projectId);
      return sendSuccess(res, data);
    } catch (err) {
      return handleError(res, err);
    }
  },
  async getThemeBySource(req: Request, res: Response) {
    try {
      const projectId = req.params['projectId'] as string;
      const data = await segmentService.getThemeBySource(projectId);
      return sendSuccess(res, data);
    } catch (err) {
      return handleError(res, err);
    }
  },
};
