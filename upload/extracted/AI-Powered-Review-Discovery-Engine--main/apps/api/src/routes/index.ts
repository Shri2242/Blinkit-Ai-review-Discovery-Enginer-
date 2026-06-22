import { Router } from 'express';

import aiProcessorRouter from '../modules/ai-processor/processor.routes.js';
import apikeyRouter from '../modules/apikeys/apikey.routes.js';
import authRouter from '../modules/auth/auth.routes.js';
import collectorRouter from '../modules/collectors/collector.routes.js';
import embeddingRouter from '../modules/embeddings/embedding.routes.js';
import healthRouter from '../modules/health/health.routes.js';
import ingestionRouter from '../modules/ingestion/ingestion.routes.js';
import insightsRouter from '../modules/insights/insights.routes.js';
import projectRouter from '../modules/projects/project.routes.js';
import ragRouter from '../modules/rag/rag.routes.js';
import reportRouter from '../modules/reports/report.routes.js';
import segmentRouter from '../modules/segments/segment.routes.js';
import teamRouter from '../modules/teams/team.routes.js';

const router: Router = Router();

// ── Mount Routes ─────────────────────────────────────────────────────────────
router.use('/health', healthRouter);
router.use('/auth', authRouter);
// Team router MUST come before projectRouter so its public invite-preview route
// is not caught by the project router's global requireAuth middleware.
router.use('/projects/:projectId/teams', teamRouter);
router.use('/projects/:projectId/api-keys', apikeyRouter);
router.use('/projects/:projectId/ingestion', ingestionRouter);
router.use('/projects/:projectId/segments', segmentRouter);
router.use('/projects/:projectId/ai', aiProcessorRouter);
router.use('/projects/:projectId/embeddings', embeddingRouter);
router.use('/projects/:projectId/chat', ragRouter);
router.use('/projects/:projectId/insights', insightsRouter);
router.use('/projects/:projectId/reports', reportRouter);
router.use('/projects/:projectId/collectors', collectorRouter);
router.use('/projects', projectRouter);

export default router;
