import { Router } from 'express';

import * as teamController from './team.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireProjectAccess } from '../../middleware/project-access.js';

const router: Router = Router({ mergeParams: true });

// ── Public (no auth) ─────────────────────────────────────────────────────────
// View invite details — shown before the invitee logs in / registers
router.get('/invite/:token', teamController.getInvite);

// ── Authenticated routes ──────────────────────────────────────────────────────
// List members — any project member
router.get('/members', requireAuth, requireProjectAccess(), teamController.listMembers);

// Accept invite — any authenticated user (email verified in service)
router.post('/accept/:token', requireAuth, teamController.acceptInvite);

// Admin-only routes
router.post('/invite', requireAuth, requireProjectAccess(['admin']), teamController.inviteMember);
router.patch(
  '/:memberId/role',
  requireAuth,
  requireProjectAccess(['admin']),
  teamController.updateRole
);
router.delete(
  '/:memberId',
  requireAuth,
  requireProjectAccess(['admin']),
  teamController.removeMember
);

export default router;
