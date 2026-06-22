import { pgTable, uuid, varchar, timestamp, integer, index } from 'drizzle-orm/pg-core';

import { projects } from './projects.js';
import { reviews } from './reviews.js';

export const reviewEmbeddings = pgTable(
  'review_embeddings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reviewId: uuid('review_id')
      .notNull()
      .references(() => reviews.id, { onDelete: 'cascade' })
      .unique(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    embeddingModel: varchar('embedding_model', { length: 255 }).notNull(),
    dimensions: integer('dimensions').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('review_embeddings_project_idx').on(table.projectId),
    index('review_embeddings_review_idx').on(table.reviewId),
  ]
);
