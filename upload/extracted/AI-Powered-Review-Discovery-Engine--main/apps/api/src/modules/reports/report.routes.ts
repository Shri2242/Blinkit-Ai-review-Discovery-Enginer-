import { Router } from 'express';

import * as reportController from './report.controller.js';
import * as webhookController from './webhook.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireProjectAccess } from '../../middleware/project-access.js';

const router: Router = Router({ mergeParams: true });

router.use(requireAuth);
router.use(requireProjectAccess());

// Report schedules — admin only
router.post('/schedules', requireProjectAccess(['admin']), reportController.createSchedule);
router.get('/schedules', reportController.listSchedules);
router.patch('/schedules/:id', requireProjectAccess(['admin']), reportController.updateSchedule);
router.delete('/schedules/:id', requireProjectAccess(['admin']), reportController.deleteSchedule);

// On-demand report generation — admin and analyst
router.post(
  '/generate',
  requireProjectAccess(['admin', 'analyst']),
  reportController.generateReport
);

// Webhooks — admin only
router.post('/webhooks', requireProjectAccess(['admin']), webhookController.createWebhook);
router.get('/webhooks', webhookController.listWebhooks);
router.patch('/webhooks/:id', requireProjectAccess(['admin']), webhookController.updateWebhook);
router.delete('/webhooks/:id', requireProjectAccess(['admin']), webhookController.deleteWebhook);
router.get('/webhooks/:id/deliveries', webhookController.getDeliveries);

export default router;
