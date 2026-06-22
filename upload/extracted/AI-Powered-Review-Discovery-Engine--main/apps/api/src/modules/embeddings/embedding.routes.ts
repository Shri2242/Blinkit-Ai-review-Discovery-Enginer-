import { Router } from 'express';

import * as embeddingController from './embedding.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireProjectAccess } from '../../middleware/project-access.js';

const router: Router = Router({ mergeParams: true });

// Require auth and project membership for any action
router.use(requireAuth);
router.use(requireProjectAccess());

// generate embeddings requires admin/analyst role
router.post('/generate', requireProjectAccess(['admin', 'analyst']), embeddingController.generate);
// search and stats can be accessed by any project member
router.post('/search', embeddingController.search);
router.get('/stats', embeddingController.getStats);

export default router;
