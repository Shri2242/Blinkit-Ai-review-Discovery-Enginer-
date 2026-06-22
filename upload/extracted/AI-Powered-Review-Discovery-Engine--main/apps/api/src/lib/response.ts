import { Response } from 'express';

import { AppError } from './errors.js';

export function sendSuccess<T>(res: Response, data: T, meta?: object, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data, ...(meta && { meta }) });
}

export function sendError(res: Response, error: AppError) {
  return res
    .status(error.statusCode)
    .json({ success: false, error: { code: error.code, message: error.message } });
}

export function sendAccepted<T>(res: Response, data: T) {
  return res.status(202).json({ success: true, data });
}
