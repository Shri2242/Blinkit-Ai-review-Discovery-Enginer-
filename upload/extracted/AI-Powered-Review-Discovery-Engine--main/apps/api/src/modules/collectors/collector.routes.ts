import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';

import { collectorController } from './collector.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireProjectAccess } from '../../middleware/project-access.js';

const router: ExpressRouter = Router({ mergeParams: true });

router.use(requireAuth);

// Available types (authenticated but no project role required)
router.get('/types', collectorController.getAvailableTypes);

// CRUD — admin only
router.post('/', requireProjectAccess(['admin']), collectorController.createSource);
router.get('/', collectorController.listSources);
router.patch('/:sourceId', requireProjectAccess(['admin']), collectorController.updateSource);
router.patch(
  '/:sourceId/toggle',
  requireProjectAccess(['admin']),
  collectorController.toggleSource
);
router.delete('/:sourceId', requireProjectAccess(['admin']), collectorController.deleteSource);

// Run collection — admin and analyst
router.post('/run-all', requireProjectAccess(['admin', 'analyst']), collectorController.runAll);
router.post(
  '/:sourceId/run',
  requireProjectAccess(['admin', 'analyst']),
  collectorController.runCollection
);
router.get('/:sourceId/logs', collectorController.getLogs);

export default router;
