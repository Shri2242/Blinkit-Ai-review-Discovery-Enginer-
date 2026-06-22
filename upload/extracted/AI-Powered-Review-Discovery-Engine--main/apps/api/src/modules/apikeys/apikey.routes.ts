import { Router } from 'express';

import * as apikeyController from './apikey.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireProjectAccess } from '../../middleware/project-access.js';

const router: Router = Router({ mergeParams: true });

router.use(requireAuth);
router.use(requireProjectAccess(['admin']));

router.post('/', apikeyController.generateKey);
router.get('/', apikeyController.listKeys);
router.delete('/:id', apikeyController.revokeKey);

export default router;
