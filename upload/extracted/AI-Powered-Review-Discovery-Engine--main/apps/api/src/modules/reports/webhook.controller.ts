import { NextFunction, Request, Response } from 'express';

import * as webhookService from './webhook.service.js';
import { sendSuccess } from '../../lib/response.js';

export async function createWebhook(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = req.params['projectId'] as string;
    const userId = req.user!.userId;
    const config = await webhookService.createWebhook(projectId, userId, req.body);
    return sendSuccess(res, config, undefined, 201);
  } catch (error) {
    next(error);
  }
}

export async function listWebhooks(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = req.params['projectId'] as string;
    const configs = await webhookService.listWebhooks(projectId);
    return sendSuccess(res, configs);
  } catch (error) {
    next(error);
  }
}

export async function updateWebhook(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = req.params['projectId'] as string;
    const webhookId = req.params['id'] as string;
    const updated = await webhookService.updateWebhook(projectId, webhookId, req.body);
    return sendSuccess(res, updated);
  } catch (error) {
    next(error);
  }
}

export async function deleteWebhook(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = req.params['projectId'] as string;
    const webhookId = req.params['id'] as string;
    await webhookService.deleteWebhook(projectId, webhookId);
    return res.status(204).end();
  } catch (error) {
    next(error);
  }
}

export async function getDeliveries(req: Request, res: Response, next: NextFunction) {
  try {
    const webhookId = req.params['id'] as string;
    const limitQuery = req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : undefined;
    const deliveries = await webhookService.getWebhookDeliveries(webhookId, limitQuery);
    return sendSuccess(res, deliveries);
  } catch (error) {
    next(error);
  }
}
