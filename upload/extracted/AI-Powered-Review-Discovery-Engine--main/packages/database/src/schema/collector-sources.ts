import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  integer,
  jsonb,
  text,
  index,
} from 'drizzle-orm/pg-core';

import { projects } from './projects.js';

export const collectorSources = pgTable(
  'collector_sources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    project_id: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    source_type: varchar('source_type', { length: 50 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    config: jsonb('config').notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    schedule: varchar('schedule', { length: 50 }).default('0 9 * * *').notNull(),
    last_run_at: timestamp('last_run_at', { withTimezone: true }),
    last_run_status: varchar('last_run_status', { length: 20 }),
    last_run_count: integer('last_run_count').default(0),
    total_collected: integer('total_collected').default(0).notNull(),
    error_message: text('error_message'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('collector_sources_project_idx').on(table.project_id),
    index('collector_sources_enabled_idx').on(table.enabled),
  ]
);

export const collectorLogs = pgTable('collector_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  source_id: uuid('source_id')
    .notNull()
    .references(() => collectorSources.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 20 }).notNull(),
  reviews_fetched: integer('reviews_fetched').default(0),
  reviews_new: integer('reviews_new').default(0),
  reviews_duplicate: integer('reviews_duplicate').default(0),
  duration_ms: integer('duration_ms'),
  error_message: text('error_message'),
  started_at: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  completed_at: timestamp('completed_at', { withTimezone: true }),
});
