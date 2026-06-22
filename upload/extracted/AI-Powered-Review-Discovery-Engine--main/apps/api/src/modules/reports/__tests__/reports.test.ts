import crypto from 'crypto';

import { eq } from 'drizzle-orm';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

import { db, reportSchedules, webhookConfigs } from '@review-engine/database';

import {
  createTestDb,
  resetTestDb,
  createTestUser,
  createTestProject,
  createTestReview,
} from '../../../__tests__/helpers/test-utils.js';
import * as reportService from '../report.service.js';
import * as webhookService from '../webhook.service.js';

describe('Reports and Webhooks Module', () => {
  beforeAll(async () => {
    await createTestDb();
    await resetTestDb();
  });

  afterAll(async () => {
    await resetTestDb();
    vi.restoreAllMocks();
  });

  describe('Report Schedule Calculations & CRUD', () => {
    it('should compute next_send_at correctly', () => {
      // Set fixed reference point: Friday, June 19, 2026, 12:00:00 UTC
      const reference = new Date(Date.UTC(2026, 5, 19, 12, 0, 0, 0));

      const daily = reportService.calculateNextSendAt('daily', reference);
      // Next day (Saturday, June 20, 2026, 09:00:00 UTC)
      expect(daily.toISOString()).toBe('2026-06-20T09:00:00.000Z');

      const weekly = reportService.calculateNextSendAt('weekly', reference);
      // Next Monday (Monday, June 22, 2026, 09:00:00 UTC)
      expect(weekly.toISOString()).toBe('2026-06-22T09:00:00.000Z');

      const monthly = reportService.calculateNextSendAt('monthly', reference);
      // 1st of next month (July 1, 2026, 09:00:00 UTC)
      expect(monthly.toISOString()).toBe('2026-07-01T09:00:00.000Z');
    });

    it('should perform report schedules CRUD operations successfully', async () => {
      const user = await createTestUser({ email: 'schedules-user@test.com' });
      const project = await createTestProject(user.id);

      // 1. Create Schedule
      const schedule = await reportService.createSchedule(project.id, user.id, {
        name: 'Weekly Analytical Report',
        frequency: 'weekly',
        recipients: ['analyst@company.com'],
        include_summary: true,
      });

      expect(schedule).toBeDefined();
      expect(schedule.id).toBeDefined();
      expect(schedule.name).toBe('Weekly Analytical Report');
      expect(schedule.frequency).toBe('weekly');
      expect(schedule.include_sentiment).toBe(true); // default from Zod schema
      expect(schedule.next_send_at).toBeDefined();

      // 2. List Schedules
      const list = await reportService.listSchedules(project.id);
      expect(list).toHaveLength(1);
      expect(list[0]?.id).toBe(schedule.id);

      // 3. Update Schedule
      const updated = await reportService.updateSchedule(project.id, schedule.id, {
        name: 'Updated Report Title',
        frequency: 'monthly',
      });
      expect(updated.name).toBe('Updated Report Title');
      expect(updated.frequency).toBe('monthly');

      // 4. Delete Schedule
      await reportService.deleteSchedule(project.id, schedule.id);
      const afterDeleteList = await reportService.listSchedules(project.id);
      expect(afterDeleteList).toHaveLength(0);
    });
  });

  describe('Report Generation', () => {
    it('should generate report on-demand and update schedule state when scheduled', async () => {
      const user = await createTestUser({ email: 'gen-user@test.com' });
      const project = await createTestProject(user.id);

      // Add a test review to avoid empty analytics errors
      await createTestReview(project.id, {
        reviewText: 'Great onboarding flow!',
        rating: 5,
        sentiment: 'positive',
        theme: 'onboarding',
        processingStatus: 'completed',
      });

      // Generate on-demand
      const report = await reportService.generateReport(project.id);
      expect(report.projectId).toBe(project.id);
      expect(report.overview).toBeDefined();
      expect(report.sentimentTrend).toBeDefined();
      expect(report.weeklySummary).not.toBeNull(); // defaults to not null since include_summary is true for on-demand

      // Generate with scheduleId
      const schedule = await reportService.createSchedule(project.id, user.id, {
        name: 'Weekly Analytical Report 2',
        frequency: 'weekly',
        recipients: ['analyst2@company.com'],
        include_summary: false,
      });

      const reportWithSchedule = await reportService.generateReport(project.id, schedule.id);
      expect(reportWithSchedule.projectId).toBe(project.id);

      // Verify schedule updated last_sent_at and next_send_at
      const [updatedSchedule] = await db
        .select()
        .from(reportSchedules)
        .where(eq(reportSchedules.id, schedule.id))
        .limit(1);

      expect(updatedSchedule?.last_sent_at).toBeDefined();
      expect(updatedSchedule?.next_send_at).toBeDefined();
      expect(updatedSchedule?.last_sent_at?.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('Webhook Integrations Service', () => {
    it('should CRUD webhooks and ensure secret is private', async () => {
      const user = await createTestUser({ email: 'webhooks-user@test.com' });
      const project = await createTestProject(user.id);

      // 1. Create Webhook
      const webhook = await webhookService.createWebhook(project.id, user.id, {
        name: 'Slack Alerts',
        url: 'https://hooks.slack.com/services/test-url',
        events: ['review.ingested', 'sentiment.negative_spike'],
      });

      expect(webhook).toBeDefined();
      expect(webhook.id).toBeDefined();
      expect(webhook.secret).toBeDefined(); // Secret exists on creation
      expect(webhook.secret).toHaveLength(64); // 32 bytes hex

      // 2. List Webhooks (secret should be hidden)
      const list = await webhookService.listWebhooks(project.id);
      expect(list).toHaveLength(1);
      expect((list[0] as Record<string, unknown>).secret).toBeUndefined();

      // 3. Update Webhook
      const updated = await webhookService.updateWebhook(project.id, webhook.id, {
        name: 'Updated Slack alerts name',
      });
      expect(updated.name).toBe('Updated Slack alerts name');
      expect((updated as Record<string, unknown>).secret).toBeUndefined(); // Secret should not return in update responses

      // 4. Get webhook deliveries (initially empty)
      const deliveries = await webhookService.getWebhookDeliveries(webhook.id);
      expect(deliveries).toHaveLength(0);

      // 5. Delete Webhook
      await webhookService.deleteWebhook(project.id, webhook.id);
      const afterDeleteList = await webhookService.listWebhooks(project.id);
      expect(afterDeleteList).toHaveLength(0);
    });

    it('should sign and dispatch webhooks, saving execution log', async () => {
      const user = await createTestUser({ email: 'webhook-dispatch@test.com' });
      const project = await createTestProject(user.id);

      const mockWebhookUrl = 'https://my-endpoint.com/webhook';
      const webhook = await webhookService.createWebhook(project.id, user.id, {
        name: 'Local Endpoint',
        url: mockWebhookUrl,
        events: ['review.ingested'],
      });

      // Spy on fetch
      let interceptedHeaders: { get: (name: string) => string | null } = { get: () => null };
      let interceptedBody: string | null = null;

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((_url, options) => {
        interceptedHeaders = new Headers(options?.headers);
        interceptedBody = options?.body as string;
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve('OK Response'),
        } as Response);
      });

      const payload = { batchId: 'b-1234', inserted: 5, skipped: 1 };
      await webhookService.triggerWebhooks(project.id, 'review.ingested', payload);

      // Sleep briefly for fire-and-forget promise resolution
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(fetchSpy).toHaveBeenCalled();
      expect(interceptedHeaders).toBeDefined();
      expect(interceptedHeaders.get('X-Webhook-Event')).toBe('review.ingested');
      expect(interceptedHeaders.get('X-Webhook-Delivery')).toBeDefined();

      const expectedSignature = crypto
        .createHmac('sha256', webhook.secret!)
        .update(JSON.stringify(payload))
        .digest('hex');
      expect(interceptedHeaders.get('X-Webhook-Signature')).toBe(`sha256=${expectedSignature}`);
      expect(interceptedBody).toBe(JSON.stringify(payload));

      // Verify delivery is logged in DB
      const deliveries = await webhookService.getWebhookDeliveries(webhook.id);
      expect(deliveries).toHaveLength(1);
      expect(deliveries[0]?.event).toBe('review.ingested');
      expect(deliveries[0]?.success).toBe(true);
      expect(deliveries[0]?.status_code).toBe(200);
      expect(deliveries[0]?.response_body).toBe('OK Response');

      // Cleanup spy
      fetchSpy.mockRestore();
    });

    it('should disable webhook after 10 consecutive failures', async () => {
      const user = await createTestUser({ email: 'webhook-failures@test.com' });
      const project = await createTestProject(user.id);

      const webhook = await webhookService.createWebhook(project.id, user.id, {
        name: 'Failing Endpoint',
        url: 'https://failing-endpoint.com',
        events: ['review.analyzed'],
      });

      // Mock fetch to fail
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
        return Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          text: () => Promise.resolve('Failed to process'),
        } as Response);
      });

      const payload = { processed: 10, failed: 2 };

      // Trigger 10 failures
      for (let i = 0; i < 10; i++) {
        await webhookService.triggerWebhooks(project.id, 'review.analyzed', payload);
        await new Promise((resolve) => setTimeout(resolve, 15));
      }

      // Check current config
      let [currentConfig] = await db
        .select()
        .from(webhookConfigs)
        .where(eq(webhookConfigs.id, webhook.id))
        .limit(1);
      expect(currentConfig?.failure_count).toBe(10);
      expect(currentConfig?.enabled).toBe(true); // Disabled only after failure count > 10 (consecutive 11th failure)

      // Trigger 11th failure
      await webhookService.triggerWebhooks(project.id, 'review.analyzed', payload);
      await new Promise((resolve) => setTimeout(resolve, 20));

      [currentConfig] = await db
        .select()
        .from(webhookConfigs)
        .where(eq(webhookConfigs.id, webhook.id))
        .limit(1);

      expect(currentConfig?.failure_count).toBe(11);
      expect(currentConfig?.enabled).toBe(false); // Automatically disabled

      fetchSpy.mockRestore();
    });
  });
});
