import {
  pgTable,
  uuid,
  date,
  real,
  integer,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

import { projects } from './projects.js';

export const analyticsDaily = pgTable(
  'analytics_daily',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),
    date: date('date').notNull(),
    totalReviews: integer('total_reviews').default(0).notNull(),
    avgRating: real('avg_rating'),
    sentimentPositive: integer('sentiment_positive').default(0).notNull(),
    sentimentNegative: integer('sentiment_negative').default(0).notNull(),
    sentimentNeutral: integer('sentiment_neutral').default(0).notNull(),
    sentimentMixed: integer('sentiment_mixed').default(0).notNull(),
    topThemes: jsonb('top_themes').default([]).notNull(),
    topIssues: jsonb('top_issues').default([]).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('analytics_daily_project_date_idx').on(table.projectId, table.date),
    index('analytics_daily_project_idx').on(table.projectId),
  ]
);
