import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  integer,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

import { projects } from './projects.js';
import { themeCategoryEnum, priorityLevelEnum } from './reviews.js';

export const insights = pgTable(
  'insights',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),
    insightType: varchar('insight_type', { length: 50 }).notNull(),
    theme: themeCategoryEnum('theme'),
    title: varchar('title', { length: 500 }).notNull(),
    summary: text('summary').notNull(),
    details: jsonb('details').default({}).notNull(),
    severity: priorityLevelEnum('severity'),
    reviewCount: integer('review_count').default(0).notNull(),
    dateRangeStart: timestamp('date_range_start', { withTimezone: true }),
    dateRangeEnd: timestamp('date_range_end', { withTimezone: true }),
    isRead: boolean('is_read').default(false).notNull(),
    isDismissed: boolean('is_dismissed').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('insights_project_idx').on(table.projectId),
    index('insights_project_type_idx').on(table.projectId, table.insightType),
  ]
);
