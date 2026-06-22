import { and, desc, eq } from 'drizzle-orm';

import { db, reportSchedules, activityLog } from '@review-engine/database';

import { createScheduleSchema, updateScheduleSchema } from './report.schema.js';
import { NotFoundError } from '../../lib/errors.js';
import {
  DashboardOverview,
  SentimentTrend,
  TopIssue,
  WeeklySummary,
} from '../insights/insights.service.js';
import * as insightsService from '../insights/insights.service.js';

export interface GeneratedReport {
  projectId: string;
  generatedAt: Date;
  period: { from: Date; to: Date };
  overview: DashboardOverview;
  sentimentTrend: SentimentTrend[];
  topIssues: TopIssue[];
  weeklySummary: WeeklySummary | null;
}

export function calculateNextSendAt(
  frequency: 'daily' | 'weekly' | 'monthly',
  fromDate = new Date()
): Date {
  const next = new Date(fromDate);
  if (frequency === 'daily') {
    next.setUTCDate(next.getUTCDate() + 1);
    next.setUTCHours(9, 0, 0, 0);
  } else if (frequency === 'weekly') {
    const day = next.getUTCDay();
    const daysToAdd = day === 0 ? 1 : 8 - day;
    next.setUTCDate(next.getUTCDate() + daysToAdd);
    next.setUTCHours(9, 0, 0, 0);
  } else if (frequency === 'monthly') {
    next.setUTCMonth(next.getUTCMonth() + 1);
    next.setUTCDate(1);
    next.setUTCHours(9, 0, 0, 0);
  }
  return next;
}

export async function createSchedule(projectId: string, userId: string, data: unknown) {
  // Validate input
  const validated = createScheduleSchema.parse(data);

  const nextSendAt = calculateNextSendAt(validated.frequency);

  const [schedule] = await db
    .insert(reportSchedules)
    .values({
      project_id: projectId,
      created_by: userId,
      name: validated.name,
      frequency: validated.frequency,
      recipients: validated.recipients,
      include_sentiment: validated.include_sentiment,
      include_themes: validated.include_themes,
      include_top_issues: validated.include_top_issues,
      include_summary: validated.include_summary,
      enabled: validated.enabled,
      next_send_at: nextSendAt,
    })
    .returning();

  if (!schedule) {
    throw new Error('Failed to create report schedule');
  }

  // Log activity
  await db.insert(activityLog).values({
    userId,
    projectId,
    action: 'report.schedule_created',
    entityType: 'report_schedule',
    entityId: schedule.id,
    details: { name: schedule.name, frequency: schedule.frequency },
  });

  return schedule;
}

export async function listSchedules(projectId: string) {
  return db
    .select()
    .from(reportSchedules)
    .where(eq(reportSchedules.project_id, projectId))
    .orderBy(desc(reportSchedules.created_at));
}

export async function updateSchedule(projectId: string, scheduleId: string, data: unknown) {
  const validated = updateScheduleSchema.parse(data);

  const [existing] = await db
    .select()
    .from(reportSchedules)
    .where(and(eq(reportSchedules.id, scheduleId), eq(reportSchedules.project_id, projectId)))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Report schedule not found');
  }

  const updates: Partial<typeof reportSchedules.$inferInsert> = {
    ...validated,
    updated_at: new Date(),
  };

  if (validated.frequency && validated.frequency !== existing.frequency) {
    updates.next_send_at = calculateNextSendAt(validated.frequency);
  }

  const [updated] = await db
    .update(reportSchedules)
    .set(updates)
    .where(eq(reportSchedules.id, scheduleId))
    .returning();

  if (!updated) {
    throw new NotFoundError('Report schedule not found');
  }

  return updated;
}

export async function deleteSchedule(projectId: string, scheduleId: string): Promise<void> {
  const [deleted] = await db
    .delete(reportSchedules)
    .where(and(eq(reportSchedules.id, scheduleId), eq(reportSchedules.project_id, projectId)))
    .returning();

  if (!deleted) {
    throw new NotFoundError('Report schedule not found');
  }
}

export async function generateReport(
  projectId: string,
  scheduleId?: string
): Promise<GeneratedReport> {
  let includeSentiment = true;
  let includeTopIssues = true;
  let includeSummary = true;
  let frequency: 'daily' | 'weekly' | 'monthly' = 'weekly';
  let scheduleRecord: typeof reportSchedules.$inferSelect | null = null;

  if (scheduleId) {
    const [foundSchedule] = await db
      .select()
      .from(reportSchedules)
      .where(and(eq(reportSchedules.id, scheduleId), eq(reportSchedules.project_id, projectId)))
      .limit(1);

    if (!foundSchedule) {
      throw new NotFoundError('Report schedule not found');
    }

    scheduleRecord = foundSchedule;

    includeSentiment = scheduleRecord.include_sentiment;
    includeTopIssues = scheduleRecord.include_top_issues;
    includeSummary = scheduleRecord.include_summary;
    frequency = scheduleRecord.frequency as 'daily' | 'weekly' | 'monthly';
  }

  // Calculate timeseries days based on frequency
  const days = frequency === 'monthly' ? 30 : 7;
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const to = new Date();

  // Reuse insightsService to populate fields
  const overview = await insightsService.getDashboardOverview(projectId);

  let sentimentTrend: SentimentTrend[] = [];
  if (includeSentiment) {
    sentimentTrend = await insightsService.getSentimentTrend(projectId, days);
  }

  let topIssues: TopIssue[] = [];
  if (includeTopIssues) {
    topIssues = await insightsService.getTopIssues(projectId);
  }

  let weeklySummary: WeeklySummary | null = null;
  if (includeSummary) {
    weeklySummary = await insightsService.generateWeeklySummary(projectId);
  }

  const generatedAt = new Date();

  // If scheduleId provided: update last_sent_at, calculate next_send_at
  if (scheduleId && scheduleRecord) {
    const nextSendAt = calculateNextSendAt(frequency, generatedAt);
    await db
      .update(reportSchedules)
      .set({
        last_sent_at: generatedAt,
        next_send_at: nextSendAt,
        updated_at: generatedAt,
      })
      .where(eq(reportSchedules.id, scheduleId));
  }

  // Log activity (log system-generated activity if no user, fallback to system/anonymous)
  await db.insert(activityLog).values({
    projectId,
    action: 'report.generated',
    entityType: 'report',
    details: { scheduleId: scheduleId || null },
  });

  return {
    projectId,
    generatedAt,
    period: { from, to },
    overview,
    sentimentTrend,
    topIssues,
    weeklySummary,
  };
}
