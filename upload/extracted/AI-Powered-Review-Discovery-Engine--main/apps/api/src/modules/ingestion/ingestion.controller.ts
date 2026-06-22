import fs from 'fs';
import os from 'os';
import path from 'path';

import { NextFunction, Request, RequestHandler, Response } from 'express';
import multer from 'multer';

import * as ingestionService from './ingestion.service.js';
import { ValidationError } from '../../lib/errors.js';
import { sendSuccess } from '../../lib/response.js';

// Sanitize filename to prevent path traversal attacks
function sanitizeFilename(name: string): string {
  return path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');
}

// Configure multer
const upload = multer({
  dest: os.tmpdir(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.csv' && ext !== '.json') {
      return cb(new ValidationError('Unsupported file type. Only CSV and JSON are accepted.'));
    }
    // Sanitize originalname to prevent path traversal
    file.originalname = sanitizeFilename(file.originalname);
    cb(null, true);
  },
});

export const uploadMiddleware: RequestHandler = upload.single('file');

/**
 * Handle POST /projects/:projectId/ingestion/ingest
 */
export async function ingest(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = req.params['projectId'] as string;
    const userId = req.user!.userId;

    if (!req.file) {
      throw new ValidationError('File is required');
    }

    const result = await ingestionService.ingestFromFile(projectId, userId, req.file);
    return sendSuccess(res, result, undefined, 201);
  } catch (error) {
    next(error);
  } finally {
    // Clean up temp file
    if (req.file?.path) {
      fs.unlink(req.file.path, (err) => {
        if (err) {
          console.error(`Failed to delete temp file ${req.file?.path}:`, err);
        }
      });
    }
  }
}

/**
 * Handle GET /projects/:projectId/ingestion/batches
 */
export async function getBatches(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = req.params['projectId'] as string;
    const result = await ingestionService.getUploadHistory(projectId);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

/**
 * Handle GET /projects/:projectId/ingestion/batches/:batchId
 */
export async function getBatchDetails(req: Request, res: Response, next: NextFunction) {
  try {
    const batchId = req.params['batchId'] as string;
    const result = await ingestionService.getBatchDetails(batchId);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}
