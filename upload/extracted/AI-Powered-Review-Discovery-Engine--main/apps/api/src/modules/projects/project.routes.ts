import { Router } from 'express';

import * as projectController from './project.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireProjectAccess } from '../../middleware/project-access.js';

const router: Router = Router();

// All routes require authentication
router.use(requireAuth);

// List and create — any authenticated user
router.get('/', projectController.listProjects);
router.post('/', projectController.createProject);

// Single project operations — require project membership
router.get('/:id', requireProjectAccess(), projectController.getProject);
router.patch('/:id', requireProjectAccess(['admin']), projectController.updateProject);
router.delete('/:id', requireProjectAccess(['admin']), projectController.deleteProject);

export default router;
