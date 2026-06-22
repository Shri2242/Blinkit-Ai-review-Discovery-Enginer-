import { Router } from 'express';

import * as ragController from './rag.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireProjectAccess } from '../../middleware/project-access.js';
import { chatRateLimiter } from '../../middleware/rate-limiter.js';

const router: Router = Router({ mergeParams: true });

// Require auth and project membership (any member role is allowed)
router.use(requireAuth);
router.use(requireProjectAccess());

router.post('/', chatRateLimiter, ragController.chat);

router.get('/history', ragController.getHistory);
router.get('/stats', ragController.getStats);

export default router;
