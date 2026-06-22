import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  smallint,
  real,
  boolean,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

import { projects } from './projects.js';
import { users } from './users.js';

// ── Enums ───────────────────────────────────────────────────────────────────

export const reviewSourceEnum = pgEnum('review_source', [
  'csv_upload',
  'app_store',
  'google_play',
  'g2',
  'trustpilot',
  'manual',
]);

export const sentimentEnum = pgEnum('sentiment_type', ['positive', 'negative', 'neutral', 'mixed']);

export const themeCategoryEnum = pgEnum('theme_category', [
  'payment',
  'performance',
  'usability',
  'onboarding',
  'features',
  'support',
  'pricing',
  'security',
  'reliability',
  'content',
]);

export const priorityLevelEnum = pgEnum('priority_level', ['critical', 'high', 'medium', 'low']);

export const processingStatusEnum = pgEnum('processing_status', [
  'pending',
  'processing',
  'completed',
  'failed',
]);

// ── Reviews Table ───────────────────────────────────────────────────────────

export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),
    uploadBatchId: uuid('upload_batch_id').references(() => uploadBatches.id, {
      onDelete: 'cascade',
    }),
    source: reviewSourceEnum('source').notNull(),
    sourceReviewId: varchar('source_review_id', { length: 255 }),
    reviewText: text('review_text').notNull(),
    reviewTitle: text('review_title'),
    rating: smallint('rating'),
    authorName: varchar('author_name', { length: 255 }),
    reviewDate: timestamp('review_date', { withTimezone: true }).notNull(),
    language: varchar('language', { length: 10 }).default('en').notNull(),
    contentHash: varchar('content_hash', { length: 64 }).notNull(),
    metadata: jsonb('metadata').default({}).notNull(),

    // Processing state
    processingStatus: processingStatusEnum('processing_status').default('pending').notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    processingError: text('processing_error'),
    retryCount: smallint('retry_count').default(0).notNull(),

    // AI analysis
    sentiment: sentimentEnum('sentiment'),
    sentimentConfidence: real('sentiment_confidence'),
    theme: themeCategoryEnum('theme'),
    subTheme: varchar('sub_theme', { length: 255 }),
    priority: priorityLevelEnum('priority'),
    priorityReason: text('priority_reason'),
    keyPhrases: text('key_phrases').array(),
    aiSummary: text('ai_summary'),
    isBug: boolean('is_bug').default(false).notNull(),
    isFeatureRequest: boolean('is_feature_request').default(false).notNull(),
    actionable: boolean('actionable').default(false).notNull(),

    // Vector reference
    embeddingId: varchar('embedding_id', { length: 255 }),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('reviews_project_source_id_idx').on(
      table.projectId,
      table.source,
      table.sourceReviewId
    ),
    index('reviews_project_idx').on(table.projectId),
    index('reviews_upload_batch_idx').on(table.uploadBatchId),
    index('reviews_project_sentiment_idx').on(table.projectId, table.sentiment),
    index('reviews_project_theme_idx').on(table.projectId, table.theme),
    index('reviews_project_priority_idx').on(table.projectId, table.priority),
    index('reviews_project_date_idx').on(table.projectId, table.reviewDate),
    index('reviews_project_status_idx').on(table.projectId, table.processingStatus),
    index('reviews_content_hash_idx').on(table.contentHash),
  ]
);

// ── Upload Batches Table ────────────────────────────────────────────────────

export const uploadBatches = pgTable(
  'upload_batches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),
    uploadedBy: uuid('uploaded_by')
      .references(() => users.id)
      .notNull(),
    filename: varchar('filename', { length: 255 }).notNull(),
    source: reviewSourceEnum('source').default('csv_upload').notNull(),
    fileUrl: text('file_url'),
    totalRows: smallint('total_rows').default(0).notNull(),
    processedRows: smallint('processed_rows').default(0).notNull(),
    failedRows: smallint('failed_rows').default(0).notNull(),
    status: processingStatusEnum('status').default('pending').notNull(),
    errorLog: jsonb('error_log').default([]).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('upload_batches_project_idx').on(table.projectId),
    index('upload_batches_status_idx').on(table.status),
  ]
);
