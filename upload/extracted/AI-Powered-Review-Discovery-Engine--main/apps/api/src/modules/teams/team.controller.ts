import { NextFunction, Request, Response } from 'express';

import { inviteMemberSchema, updateRoleSchema } from './team.schema.js';
import * as teamService from './team.service.js';
import { sendSuccess } from '../../lib/response.js';

export async function listMembers(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = req.params['projectId'] as string;
    const result = await teamService.listMembers(projectId);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function inviteMember(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = req.params['projectId'] as string;
    const inviterId = req.user!.userId;
    const validatedData = inviteMemberSchema.parse(req.body);
    const result = await teamService.inviteMember(projectId, inviterId, validatedData);
    return sendSuccess(res, result, undefined, 201);
  } catch (error) {
    next(error);
  }
}

export async function getInvite(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.params['token'] as string;
    const result = await teamService.getInviteByToken(token);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function acceptInvite(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.params['token'] as string;
    const userId = req.user!.userId;
    const result = await teamService.acceptInvite(token, userId);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function updateRole(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = req.params['projectId'] as string;
    const memberId = req.params['memberId'] as string;
    const updaterId = req.user!.userId;
    const { role } = updateRoleSchema.parse(req.body);
    const result = await teamService.updateMemberRole(projectId, updaterId, memberId, role);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function removeMember(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = req.params['projectId'] as string;
    const memberId = req.params['memberId'] as string;
    const removerId = req.user!.userId;
    await teamService.removeMember(projectId, removerId, memberId);
    return res.status(204).end();
  } catch (error) {
    next(error);
  }
}
