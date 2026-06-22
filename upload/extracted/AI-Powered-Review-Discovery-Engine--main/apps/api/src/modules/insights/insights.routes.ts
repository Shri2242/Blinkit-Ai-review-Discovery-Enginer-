import { Router } from 'express';

import * as insightsController from './insights.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireProjectAccess } from '../../middleware/project-access.js';

const router: Router = Router({ mergeParams: true });

// Require auth and project access for any dashboard analytics
router.use(requireAuth);
router.use(requireProjectAccess());

router.get('/overview', insightsController.getOverview);
router.get('/sentiment-trend', insightsController.getSentimentTrend);
router.get('/theme-trend', insightsController.getThemeTrend);
router.get('/top-issues', insightsController.getTopIssues);
router.get('/sources', insightsController.getSources);
router.post('/weekly-summary', insightsController.generateWeeklySummary);

export default router;
