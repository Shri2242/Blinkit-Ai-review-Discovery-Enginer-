import { NextFunction, Request, Response } from 'express';

import * as reportService from './report.service.js';
import { sendSuccess } from '../../lib/response.js';

export async function createSchedule(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = req.params['projectId'] as string;
    const userId = req.user!.userId;
    const schedule = await reportService.createSchedule(projectId, userId, req.body);
    return sendSuccess(res, schedule, undefined, 201);
  } catch (error) {
    next(error);
  }
}

export async function listSchedules(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = req.params['projectId'] as string;
    const schedules = await reportService.listSchedules(projectId);
    return sendSuccess(res, schedules);
  } catch (error) {
    next(error);
  }
}

export async function updateSchedule(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = req.params['projectId'] as string;
    const scheduleId = req.params['id'] as string;
    const updated = await reportService.updateSchedule(projectId, scheduleId, req.body);
    return sendSuccess(res, updated);
  } catch (error) {
    next(error);
  }
}

export async function deleteSchedule(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = req.params['projectId'] as string;
    const scheduleId = req.params['id'] as string;
    await reportService.deleteSchedule(projectId, scheduleId);
    return res.status(204).end();
  } catch (error) {
    next(error);
  }
}

export async function generateReport(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = req.params['projectId'] as string;
    const { scheduleId } = req.body;
    const report = await reportService.generateReport(projectId, scheduleId);
    return sendSuccess(res, report);
  } catch (error) {
    next(error);
  }
}
