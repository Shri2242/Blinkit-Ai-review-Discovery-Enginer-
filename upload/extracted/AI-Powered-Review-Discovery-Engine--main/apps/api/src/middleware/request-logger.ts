/* eslint-disable @typescript-eslint/no-namespace, @typescript-eslint/no-explicit-any */
import { Request, Response, NextFunction } from 'express';
import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';

declare global {
  namespace Express {
    interface Request {
      id?: string;
      startTime?: number;
      logger?: typeof logger;
    }
  }
}

export const logger = pino({
  level: process.env['NODE_ENV'] === 'production' ? 'info' : 'debug',
  transport:
    process.env['NODE_ENV'] === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = uuidv4();
  req.id = requestId;
  req.startTime = Date.now();
  req.logger = logger;

  res.on('finish', () => {
    const duration = req.startTime ? Date.now() - req.startTime : 0;
    // Extract user_id if authenticated (usually attached to req.user)
    const userId = (req as any).user?.id;

    logger.info(
      {
        request_id: req.id,
        method: req.method,
        path: req.path,
        status_code: res.statusCode,
        duration_ms: duration,
        user_id: userId || null,
        ip: req.ip || req.socket.remoteAddress || null,
      },
      'Request completed'
    );
  });

  next();
}
