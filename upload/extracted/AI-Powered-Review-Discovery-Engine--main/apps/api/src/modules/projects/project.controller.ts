import { Request, Response, NextFunction } from 'express';

import { createProjectSchema, updateProjectSchema } from './project.schema.js';
import * as projectService from './project.service.js';
import { sendSuccess } from '../../lib/response.js';

export async function listProjects(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const result = await projectService.listProjects(userId);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function createProject(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const validatedData = createProjectSchema.parse(req.body);
    const result = await projectService.createProject(userId, validatedData);
    return sendSuccess(res, result, undefined, 201);
  } catch (error) {
    next(error);
  }
}

export async function getProject(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const projectId = req.params['id'] as string;
    const result = await projectService.getProject(projectId, userId);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function updateProject(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const projectId = req.params['id'] as string;
    const validatedData = updateProjectSchema.parse(req.body);
    const result = await projectService.updateProject(projectId, userId, validatedData);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function deleteProject(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const projectId = req.params['id'] as string;
    await projectService.deleteProject(projectId, userId);
    return res.status(204).end();
  } catch (error) {
    next(error);
  }
}
