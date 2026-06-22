import { Router } from 'express';

import * as ingestionController from './ingestion.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireProjectAccess } from '../../middleware/project-access.js';

const router: Router = Router({ mergeParams: true });

// Ensure user is authenticated
router.use(requireAuth);

// POST /projects/:projectId/ingestion/ingest
router.post(
  '/ingest',
  requireProjectAccess(['admin', 'analyst']),
  ingestionController.uploadMiddleware,
  ingestionController.ingest
);

// GET /projects/:projectId/ingestion/batches
router.get('/batches', requireProjectAccess(), ingestionController.getBatches);

// GET /projects/:projectId/ingestion/batches/:batchId
router.get('/batches/:batchId', requireProjectAccess(), ingestionController.getBatchDetails);

export default router;
