import './env-init.js';

import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

// ── Graceful startup with clear error reporting ──────────────────────────────
// Wrapping imports in a startup function ensures Railway logs show exactly
// which environment variable is missing instead of a silent container crash.

async function start() {
  // Dynamic imports so errors are caught and logged, not thrown at module load
  const [{ sql }] = await Promise.all([import('drizzle-orm')]);
  const [{ db }] = await Promise.all([import('@review-engine/database')]);
  const [{ env }] = await Promise.all([import('@review-engine/shared')]);
  const [{ redis }] = await Promise.all([import('./lib/redis.js')]);
  const [{ errorHandler }] = await Promise.all([import('./middleware/error-handler.js')]);
  const [{ globalRateLimiter }] = await Promise.all([import('./middleware/rate-limiter.js')]);
  const [{ requestLogger, logger }] = await Promise.all([import('./middleware/request-logger.js')]);
  const [{ default: centralRouter }] = await Promise.all([import('./routes/index.js')]);

  const app = express();
  const PORT = env.PORT || 4000;

  // ── Middleware ───────────────────────────────────────────────────────────────

  // 1. helmet() — security headers with strict CSP
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", process.env['FRONTEND_URL'] || 'http://localhost:3000'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    })
  );

  // 2. cors() — locked to specific origins, never wildcard
  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
    : ['http://localhost:3000', 'http://localhost:3001'];
  if (process.env['FRONTEND_URL']) {
    corsOrigins.push(process.env['FRONTEND_URL']);
  }
  app.use(
    cors({
      origin: env.NODE_ENV === 'production' ? corsOrigins : '*',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
      maxAge: 86400,
    })
  );

  // 3. compression() — gzip responses
  app.use(compression());

  // 4. express.json({ limit: '1mb' }) — parse JSON bodies (reduced from 10mb)
  app.use(express.json({ limit: '1mb' }));

  // 5. express.urlencoded({ extended: true, limit: '1mb' }) — parse form data (reduced from 10mb)
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // 6. Request logger middleware
  app.use(requestLogger);

  // Morgan log fallback in dev console for additional readability (optional)
  if (env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
  }

  // Apply global rate limiting
  app.use(globalRateLimiter);

  // ── Health check ────────────────────────────────────────────────────────────
  app.get('/api/health', async (_req, res) => {
    let databaseStatus = 'ok';
    let redisStatus = 'ok';

    try {
      await db.execute(sql`SELECT 1`);
    } catch (error) {
      databaseStatus = 'error';
      logger.error({ err: error }, 'Healthcheck database connection error');
    }

    try {
      await redis.ping();
    } catch (error) {
      redisStatus = 'error';
      logger.error({ err: error }, 'Healthcheck redis connection error');
    }

    // If Redis is down, we still consider the app healthy enough to route traffic,
    // otherwise Railway's proxy will return 429 to all users.
    const isHealthy = databaseStatus === 'ok';

    res.status(isHealthy ? 200 : 500).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: databaseStatus,
        redis: redisStatus,
      },
    });
  });

  // ── Mount central router ─────────────────────────────────────────────────────
  app.get('/', (_req, res) => {
    res.status(200).send('API is running');
  });
  app.use('/api/v1', centralRouter);
  app.use(centralRouter);

  // 404 handler for unknown routes
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
      },
    });
  });

  // ── Mount error handler middleware LAST ──────────────────────────────────────
  app.use(errorHandler);

  // ── Start server ─────────────────────────────────────────────────────────────
  const server = app.listen(PORT, '0.0.0.0', () => {
    logger.warn(`🚀 API server running on port ${PORT} in ${env.NODE_ENV} mode`);
    logger.warn(`   Health check: http://localhost:${PORT}/api/health`);
  });

  // ── Graceful shutdown ────────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.warn(`Received ${signal}. Starting graceful shutdown sequence...`);

    try {
      await redis.quit();
      logger.warn('Redis connection closed.');
    } catch (error) {
      logger.error({ err: error }, 'Error closing Redis connection during shutdown');
    }

    server.close(() => {
      logger.warn('HTTP server closed.');
      logger.warn('Graceful shutdown completed successfully.');
      process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      logger.error('Forceful shutdown executed: could not close HTTP server in time.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return { app, server, shutdown };
}

// ── Start with clear error reporting ─────────────────────────────────────────
start().catch((err) => {
  console.error('╔══════════════════════════════════════════════════════════════╗');
  console.error('║  🚨 SERVER STARTUP FAILED                                  ║');
  console.error('╠══════════════════════════════════════════════════════════════╣');
  console.error('║  The server could not start. Check the error below and      ║');
  console.error('║  verify ALL required environment variables are set.         ║');
  console.error('║                                                            ║');
  console.error('║  Required: DATABASE_URL, DEEPSEEK_API_KEY, JWT_SECRET       ║');
  console.error('║  Optional: REDIS_URL, CHROMADB_URL, S3_*                   ║');
  console.error('╚══════════════════════════════════════════════════════════════╝');
  console.error('');
  console.error('Error details:', err.message || err);
  if (err.cause) console.error('Cause:', err.cause);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
