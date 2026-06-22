import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  integer,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';

import { projects } from './projects.js';
import { users } from './users.js';

export const reportSchedules = pgTable(
  'report_schedules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    project_id: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    created_by: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    frequency: varchar('frequency', { length: 20 }).notNull(), // "daily" | "weekly" | "monthly"
    recipients: jsonb('recipients').notNull(), // array of email addresses
    include_sentiment: boolean('include_sentiment').default(true).notNull(),
    include_themes: boolean('include_themes').default(true).notNull(),
    include_top_issues: boolean('include_top_issues').default(true).notNull(),
    include_summary: boolean('include_summary').default(true).notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    last_sent_at: timestamp('last_sent_at', { withTimezone: true }),
    next_send_at: timestamp('next_send_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('report_schedules_project_idx').on(table.project_id),
    index('report_schedules_next_send_idx').on(table.next_send_at),
  ]
);

export const webhookConfigs = pgTable(
  'webhook_configs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    project_id: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    created_by: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    url: varchar('url', { length: 2048 }).notNull(),
    secret: varchar('secret', { length: 255 }), // for HMAC signature verification
    events: jsonb('events').notNull(), // array of event types
    enabled: boolean('enabled').default(true).notNull(),
    failure_count: integer('failure_count').default(0).notNull(),
    last_triggered_at: timestamp('last_triggered_at', { withTimezone: true }),
    last_status_code: integer('last_status_code'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('webhook_configs_project_idx').on(table.project_id)]
);

export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    webhook_id: uuid('webhook_id')
      .notNull()
      .references(() => webhookConfigs.id, { onDelete: 'cascade' }),
    event: varchar('event', { length: 100 }).notNull(),
    payload: jsonb('payload').notNull(),
    status_code: integer('status_code'),
    response_body: varchar('response_body', { length: 2048 }),
    success: boolean('success').default(false).notNull(),
    error_message: varchar('error_message', { length: 1024 }),
    delivered_at: timestamp('delivered_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('webhook_deliveries_webhook_idx').on(table.webhook_id),
    index('webhook_deliveries_delivered_idx').on(table.delivered_at),
  ]
);
