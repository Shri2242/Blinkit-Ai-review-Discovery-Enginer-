import { NextFunction, Request, Response } from 'express';

import { generateKeySchema } from './apikey.schema.js';
import * as apikeyService from './apikey.service.js';
import { sendSuccess } from '../../lib/response.js';

export async function generateKey(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = req.params['projectId'] as string;
    const userId = req.user!.userId;
    const validatedData = generateKeySchema.parse(req.body);

    const result = await apikeyService.generateKey(projectId, userId, validatedData);

    return sendSuccess(
      res,
      {
        id: result.id,
        name: result.name,
        key_prefix: result.key_prefix,
        scopes: result.scopes,
        created_at: result.created_at,
        key: result.raw_key,
        warning: 'Store this key securely. It will not be shown again.',
      },
      undefined,
      201
    );
  } catch (error) {
    next(error);
  }
}

export async function listKeys(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = req.params['projectId'] as string;
    const result = await apikeyService.listKeys(projectId);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function revokeKey(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = req.params['projectId'] as string;
    const keyId = req.params['id'] as string;
    await apikeyService.revokeKey(projectId, keyId);
    return res.status(204).end();
  } catch (error) {
    next(error);
  }
}
