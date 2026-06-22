import { Router } from 'express';

import * as processorController from './processor.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireProjectAccess } from '../../middleware/project-access.js';

const router: Router = Router({ mergeParams: true });

// Require auth and project membership for admin/analyst roles
router.use(requireAuth);
router.use(requireProjectAccess(['admin', 'analyst']));

router.post('/process', processorController.processReviews);
router.get('/stats', processorController.getStats);
router.get('/reviews', processorController.getFilteredReviews);

export default router;
