import { z } from 'zod';

export const createScheduleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  recipients: z
    .array(z.string().email('Invalid email address'))
    .min(1, 'At least one recipient email is required'),
  include_sentiment: z.boolean().default(true),
  include_themes: z.boolean().default(true),
  include_top_issues: z.boolean().default(true),
  include_summary: z.boolean().default(true),
  enabled: z.boolean().default(true),
});

export const updateScheduleSchema = createScheduleSchema.partial();

export const createWebhookSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  url: z.string().url('Invalid webhook URL').max(2048),
  events: z
    .array(
      z.enum([
        'review.ingested',
        'review.analyzed',
        'sentiment.negative_spike',
        'report.generated',
        'issue.critical',
      ])
    )
    .min(1, 'At least one event type is required'),
  enabled: z.boolean().default(true),
});

export const updateWebhookSchema = createWebhookSchema.partial();
