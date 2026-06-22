import type { Request, Response } from 'express';

import { collectorService, SOURCE_TYPES } from './collector.service.js';
import { AppError } from '../../lib/errors.js';
import { sendSuccess, sendError } from '../../lib/response.js';

function handleError(res: Response, err: unknown, fallbackCode = 'OPERATION_FAILED') {
  if (err instanceof AppError) {
    return sendError(res, err);
  }
  return sendError(res, new AppError(500, fallbackCode, (err as Error).message));
}

export const collectorController = {
  async createSource(req: Request, res: Response) {
    try {
      const { sourceType, name, config, schedule } = req.body;
      const projectId = req.params['projectId'] as string;

      if (!SOURCE_TYPES.includes(sourceType)) {
        return sendError(
          res,
          new AppError(400, 'INVALID_SOURCE', `Must be one of: ${SOURCE_TYPES.join(', ')}`)
        );
      }
      if (!name || !config) {
        return sendError(
          res,
          new AppError(400, 'VALIDATION_ERROR', 'name and config are required')
        );
      }

      const source = await collectorService.createSource(projectId, {
        sourceType,
        name,
        config,
        schedule,
      });
      return sendSuccess(res, source, undefined, 201);
    } catch (err) {
      return handleError(res, err, 'CREATE_FAILED');
    }
  },

  async listSources(req: Request, res: Response) {
    try {
      const projectId = req.params['projectId'] as string;
      const sources = await collectorService.listSources(projectId);
      return sendSuccess(res, sources);
    } catch (err) {
      return handleError(res, err, 'LIST_FAILED');
    }
  },

  async updateSource(req: Request, res: Response) {
    try {
      const projectId = req.params['projectId'] as string;
      const sourceId = req.params['sourceId'] as string;
      const source = await collectorService.updateSource(projectId, sourceId, req.body);
      return sendSuccess(res, source);
    } catch (err) {
      return handleError(res, err, 'UPDATE_FAILED');
    }
  },

  async toggleSource(req: Request, res: Response) {
    try {
      const projectId = req.params['projectId'] as string;
      const sourceId = req.params['sourceId'] as string;
      const { enabled } = req.body;
      await collectorService.toggleSource(projectId, sourceId, enabled);
      return sendSuccess(res, { enabled });
    } catch (err) {
      return handleError(res, err, 'TOGGLE_FAILED');
    }
  },

  async deleteSource(req: Request, res: Response) {
    try {
      const projectId = req.params['projectId'] as string;
      const sourceId = req.params['sourceId'] as string;
      await collectorService.deleteSource(projectId, sourceId);
      return sendSuccess(res, { deleted: true });
    } catch (err) {
      return handleError(res, err, 'DELETE_FAILED');
    }
  },

  async runCollection(req: Request, res: Response) {
    try {
      const projectId = req.params['projectId'] as string;
      const sourceId = req.params['sourceId'] as string;
      const result = await collectorService.runCollection(projectId, sourceId);
      return sendSuccess(res, result);
    } catch (err) {
      return handleError(res, err, 'COLLECTION_FAILED');
    }
  },

  async runAll(req: Request, res: Response) {
    try {
      const projectId = req.params['projectId'] as string;
      collectorService.runAllEnabledSources(projectId).catch(console.error);
      return sendSuccess(
        res,
        { message: 'Collection started for all enabled sources' },
        undefined,
        202
      );
    } catch (err) {
      return handleError(res, err, 'COLLECTION_FAILED');
    }
  },

  async getLogs(req: Request, res: Response) {
    try {
      const sourceId = req.params['sourceId'] as string;
      const limit = parseInt(req.query['limit'] as string) || 20;
      const logs = await collectorService.getCollectionLogs(sourceId, limit);
      return sendSuccess(res, logs);
    } catch (err) {
      return handleError(res, err, 'LOGS_FAILED');
    }
  },

  async getAvailableTypes(_req: Request, res: Response) {
    return sendSuccess(res, {
      sources: [
        {
          type: 'google_play',
          label: 'Google Play',
          configFields: [
            { name: 'appId', label: 'App ID', placeholder: 'com.spotify.music', required: true },
            { name: 'lang', label: 'Language', placeholder: 'en', required: false },
            { name: 'country', label: 'Country', placeholder: 'us', required: false },
            { name: 'maxReviews', label: 'Max Reviews', placeholder: '200', required: false },
          ],
        },
        {
          type: 'app_store',
          label: 'App Store',
          configFields: [
            { name: 'appId', label: 'App ID', placeholder: '324684580', required: true },
            { name: 'country', label: 'Country', placeholder: 'us', required: false },
            { name: 'maxReviews', label: 'Max Reviews', placeholder: '200', required: false },
          ],
        },
        {
          type: 'reddit',
          label: 'Reddit',
          configFields: [
            { name: 'subreddit', label: 'Subreddit', placeholder: 'spotify', required: true },
            {
              name: 'queries',
              label: 'Search Queries (comma-separated)',
              placeholder: 'recommendations, discover weekly',
              required: false,
            },
            { name: 'maxPosts', label: 'Max Posts', placeholder: '100', required: false },
          ],
        },
        {
          type: 'twitter',
          label: 'Twitter / X',
          configFields: [
            {
              name: 'queries',
              label: 'Search Queries (comma-separated)',
              placeholder: 'spotify recommendations',
              required: true,
            },
            { name: 'maxTweets', label: 'Max Tweets', placeholder: '100', required: false },
            {
              name: 'apifyApiKey',
              label: 'Apify API Key',
              placeholder: 'apify_api_xxx',
              required: false,
            },
          ],
        },
      ],
    });
  },
};
