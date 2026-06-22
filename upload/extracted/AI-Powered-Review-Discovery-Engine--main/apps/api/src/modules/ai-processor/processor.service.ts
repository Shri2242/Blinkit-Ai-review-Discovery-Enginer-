import { and, eq, desc, asc, sql } from 'drizzle-orm';

import { AI_CONFIG } from '@review-engine/ai';
import { db, reviews as reviewsTable, activityLog } from '@review-engine/database';

import { analyzeReviewBatch } from './analysis-worker.js';
import { generateForReviews } from '../embeddings/embedding.service.js';
import * as webhookService from '../reports/webhook.service.js';

export interface ProcessingResult {
  processed: number;
  failed: number;
  totalCost: number;
  totalTokens: number;
  latencyMs: number;
  batches: number;
}

export interface ProcessingStats {
  totalReviews: number;
  processedReviews: number;
  unprocessedReviews: number;
  sentimentBreakdown: Record<string, number>;
  themeBreakdown: Record<string, number>;
  priorityBreakdown: Record<string, number>;
  bugCount: number;
  featureRequestCount: number;
}

/**
 * Fetch pending reviews, analyze them in batches, and update database.
 */
export async function processUnprocessedReviews(
  projectId: string,
  batchSize?: number
): Promise<ProcessingResult> {
  const batchSizeLimit = batchSize ?? AI_CONFIG.REVIEW_BATCH_SIZE;

  // Fetch pending reviews
  const unprocessedReviews = await db
    .select({
      id: reviewsTable.id,
      text: reviewsTable.reviewText,
      rating: reviewsTable.rating,
      title: reviewsTable.reviewTitle,
    })
    .from(reviewsTable)
    .where(and(eq(reviewsTable.projectId, projectId), eq(reviewsTable.processingStatus, 'pending')))
    .orderBy(reviewsTable.createdAt)
    .limit(batchSizeLimit);

  if (unprocessedReviews.length === 0) {
    return {
      processed: 0,
      failed: 0,
      totalCost: 0,
      totalTokens: 0,
      latencyMs: 0,
      batches: 0,
    };
  }

  let processed = 0;
  let failed = 0;
  let totalCost = 0;
  let totalTokens = 0;
  const startTime = Date.now();
  let batchesCount = 0;

  const chunkSize = AI_CONFIG.REVIEW_BATCH_SIZE;
  for (let i = 0; i < unprocessedReviews.length; i += chunkSize) {
    const chunk = unprocessedReviews.slice(i, i + chunkSize);
    batchesCount++;

    try {
      const results = await analyzeReviewBatch(chunk);

      const validThemes = [
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
      ];

      await db.transaction(async (tx) => {
        for (const result of results) {
          const theme = validThemes.includes(result.theme)
            ? (result.theme as typeof reviewsTable.$inferInsert.theme)
            : null;

          await tx
            .update(reviewsTable)
            .set({
              processingStatus: 'completed',
              sentiment: result.sentiment,
              sentimentConfidence: result.sentiment_confidence,
              priority: result.priority,
              priorityReason: result.priority_reason,
              aiSummary: result.summary,
              keyPhrases: result.key_phrases,
              isBug: result.is_bug,
              isFeatureRequest: result.is_feature_request,
              actionable: result.actionable,
              theme,
              subTheme: result.sub_theme,
              processedAt: new Date(),
            })
            .where(eq(reviewsTable.id, result.reviewId));

          processed++;
        }
      });

      // Collect usage and cost from all results in this batch
      for (const result of results) {
        if (result._usage) {
          totalTokens += result._usage.totalTokens;
        }
        if (result._cost) {
          totalCost += result._cost.totalCost;
        }
      }
    } catch (error) {
      failed += chunk.length;
      // Mark chunk as failed in DB
      for (const r of chunk) {
        await db
          .update(reviewsTable)
          .set({
            processingStatus: 'failed',
            processingError: (error as Error).message,
            processedAt: new Date(),
          })
          .where(eq(reviewsTable.id, r.id));
      }

      console.error(`Failed to process AI batch ${batchesCount}:`, error);
    }
  }

  const latencyMs = Date.now() - startTime;

  // Log activity
  await db.insert(activityLog).values({
    projectId,
    action: 'reviews.analyzed',
    entityType: 'project',
    entityId: projectId,
    details: { processed, failed, totalCost },
  });

  // Trigger webhook
  webhookService
    .triggerWebhooks(projectId, 'review.analyzed', { processed, failed })
    .catch((err) => console.error('Error triggering review.analyzed webhook:', err));

  // Trigger embedding generation for newly processed reviews (fire and forget)
  if (processed > 0) {
    const processedIds = unprocessedReviews
      .filter((r) => r.id) // all have IDs, but be safe
      .map((r) => r.id);

    if (processedIds.length > 0) {
      generateForReviews(projectId, processedIds).catch((err: Error) =>
        console.error('Auto-embedding generation failed:', err.message)
      );
    }
  }

  return {
    processed,
    failed,
    totalCost,
    totalTokens,
    latencyMs,
    batches: batchesCount,
  };
}

/**
 * Computes processing statistics for a given project.
 * Runs ONE query instead of 8 for instant dashboard loads.
 */
export async function getProcessingStats(projectId: string): Promise<ProcessingStats> {
  const rows = await db.execute(sql`
    SELECT
      COUNT(*)::int as "totalReviews",
      COUNT(CASE WHEN processing_status = 'completed' THEN 1 END)::int as "processedReviews",
      COUNT(CASE WHEN processing_status = 'pending' THEN 1 END)::int as "unprocessedReviews",
      COUNT(CASE WHEN processing_status = 'completed' AND is_bug = true THEN 1 END)::int as "bugCount",
      COUNT(CASE WHEN processing_status = 'completed' AND is_feature_request = true THEN 1 END)::int as "featureRequestCount",
      COUNT(CASE WHEN processing_status = 'completed' AND sentiment = 'positive' THEN 1 END)::int as "sentPositive",
      COUNT(CASE WHEN processing_status = 'completed' AND sentiment = 'negative' THEN 1 END)::int as "sentNegative",
      COUNT(CASE WHEN processing_status = 'completed' AND sentiment = 'neutral' THEN 1 END)::int as "sentNeutral",
      COUNT(CASE WHEN processing_status = 'completed' AND sentiment = 'mixed' THEN 1 END)::int as "sentMixed",
      COUNT(CASE WHEN processing_status = 'completed' AND priority = 'critical' THEN 1 END)::int as "prioCritical",
      COUNT(CASE WHEN processing_status = 'completed' AND priority = 'high' THEN 1 END)::int as "prioHigh",
      COUNT(CASE WHEN processing_status = 'completed' AND priority = 'medium' THEN 1 END)::int as "prioMedium",
      COUNT(CASE WHEN processing_status = 'completed' AND priority = 'low' THEN 1 END)::int as "prioLow"
    FROM reviews
    WHERE project_id = ${projectId}
  `);

  const row = rows[0] as Record<string, number> | undefined;

  const totalReviews = Number(row?.totalReviews ?? 0);
  const processedReviews = Number(row?.processedReviews ?? 0);
  const unprocessedReviews = Number(row?.unprocessedReviews ?? 0);

  const sentimentBreakdown: Record<string, number> = {};
  if (row?.sentPositive) sentimentBreakdown.positive = Number(row.sentPositive);
  if (row?.sentNegative) sentimentBreakdown.negative = Number(row.sentNegative);
  if (row?.sentNeutral) sentimentBreakdown.neutral = Number(row.sentNeutral);
  if (row?.sentMixed) sentimentBreakdown.mixed = Number(row.sentMixed);

  const priorityBreakdown: Record<string, number> = {};
  if (row?.prioCritical) priorityBreakdown.critical = Number(row.prioCritical);
  if (row?.prioHigh) priorityBreakdown.high = Number(row.prioHigh);
  if (row?.prioMedium) priorityBreakdown.medium = Number(row.prioMedium);
  if (row?.prioLow) priorityBreakdown.low = Number(row.prioLow);

  // Theme breakdown still needs GROUP BY (can't easily combine with FILTER-style aggregates)
  const themeRows = await db
    .select({
      theme: reviewsTable.theme,
      count: sql<number>`count(*)::int`,
    })
    .from(reviewsTable)
    .where(
      and(eq(reviewsTable.projectId, projectId), eq(reviewsTable.processingStatus, 'completed'))
    )
    .groupBy(reviewsTable.theme);

  const themeBreakdown: Record<string, number> = {};
  themeRows.forEach((r) => {
    if (r.theme) themeBreakdown[r.theme] = r.count;
  });

  return {
    totalReviews,
    processedReviews,
    unprocessedReviews,
    sentimentBreakdown,
    themeBreakdown,
    priorityBreakdown,
    bugCount: Number(row?.bugCount ?? 0),
    featureRequestCount: Number(row?.featureRequestCount ?? 0),
  };
}

/**
 * Filter reviews by theme, ordered by priority (critical first) then created_at DESC.
 */
export async function getReviewsByTheme(projectId: string, theme: string, limit = 50) {
  return db
    .select()
    .from(reviewsTable)
    .where(
      and(
        eq(reviewsTable.projectId, projectId),
        eq(reviewsTable.processingStatus, 'completed'),
        eq(
          reviewsTable.theme,
          theme as
            | 'payment'
            | 'performance'
            | 'usability'
            | 'onboarding'
            | 'features'
            | 'support'
            | 'pricing'
            | 'security'
            | 'reliability'
            | 'content'
        )
      )
    )
    .orderBy(
      sql`CASE
        WHEN ${reviewsTable.priority} = 'critical' THEN 1
        WHEN ${reviewsTable.priority} = 'high' THEN 2
        WHEN ${reviewsTable.priority} = 'medium' THEN 3
        WHEN ${reviewsTable.priority} = 'low' THEN 4
        ELSE 5
      END`,
      desc(reviewsTable.createdAt)
    )
    .limit(limit);
}

/**
 * Filter reviews by priority, ordered by created_at DESC.
 */
export async function getReviewsByPriority(projectId: string, priority: string, limit = 50) {
  return db
    .select()
    .from(reviewsTable)
    .where(
      and(
        eq(reviewsTable.projectId, projectId),
        eq(reviewsTable.processingStatus, 'completed'),
        eq(reviewsTable.priority, priority as 'critical' | 'high' | 'medium' | 'low')
      )
    )
    .orderBy(desc(reviewsTable.createdAt))
    .limit(limit);
}

/**
 * Filter reviews by sentiment, ordered by priority (critical first) then created_at DESC.
 */
export async function getReviewsBySentiment(projectId: string, sentiment: string, limit = 50) {
  return db
    .select()
    .from(reviewsTable)
    .where(
      and(
        eq(reviewsTable.projectId, projectId),
        eq(reviewsTable.processingStatus, 'completed'),
        eq(reviewsTable.sentiment, sentiment as 'positive' | 'negative' | 'neutral' | 'mixed')
      )
    )
    .orderBy(
      sql`CASE
        WHEN ${reviewsTable.priority} = 'critical' THEN 1
        WHEN ${reviewsTable.priority} = 'high' THEN 2
        WHEN ${reviewsTable.priority} = 'medium' THEN 3
        WHEN ${reviewsTable.priority} = 'low' THEN 4
        ELSE 5
      END`,
      desc(reviewsTable.createdAt)
    )
    .limit(limit);
}

/**
 * Advanced query fetching processed reviews with multi-filtering, pagination, and sorting.
 */
export async function getReviewsAdvanced(
  projectId: string,
  options: {
    theme?: string;
    priority?: string;
    sentiment?: string;
    source?: string;
    isBug?: boolean;
    isFeatureRequest?: boolean;
    limit?: number;
    offset?: number;
    sortBy?: 'newest' | 'oldest' | 'priority' | 'rating';
  }
) {
  const limitVal = options.limit ?? 20;
  const offsetVal = options.offset ?? 0;

  const conditions = [
    eq(reviewsTable.projectId, projectId),
    eq(reviewsTable.processingStatus, 'completed'),
  ];

  if (options.theme) {
    conditions.push(
      eq(
        reviewsTable.theme,
        options.theme as
          | 'payment'
          | 'performance'
          | 'usability'
          | 'onboarding'
          | 'features'
          | 'support'
          | 'pricing'
          | 'security'
          | 'reliability'
          | 'content'
      )
    );
  }
  if (options.priority) {
    conditions.push(
      eq(reviewsTable.priority, options.priority as 'critical' | 'high' | 'medium' | 'low')
    );
  }
  if (options.sentiment) {
    conditions.push(
      eq(reviewsTable.sentiment, options.sentiment as 'positive' | 'negative' | 'neutral' | 'mixed')
    );
  }
  if (options.source) {
    conditions.push(
      eq(
        reviewsTable.source,
        options.source as
          | 'csv_upload'
          | 'app_store'
          | 'google_play'
          | 'g2'
          | 'trustpilot'
          | 'manual'
      )
    );
  }
  if (options.isBug !== undefined) {
    conditions.push(eq(reviewsTable.isBug, options.isBug));
  }
  if (options.isFeatureRequest !== undefined) {
    conditions.push(eq(reviewsTable.isFeatureRequest, options.isFeatureRequest));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let order: any[] = [];
  if (options.sortBy === 'oldest') {
    order = [asc(reviewsTable.reviewDate)];
  } else if (options.sortBy === 'priority') {
    order = [
      sql`CASE
        WHEN ${reviewsTable.priority} = 'critical' THEN 1
        WHEN ${reviewsTable.priority} = 'high' THEN 2
        WHEN ${reviewsTable.priority} = 'medium' THEN 3
        WHEN ${reviewsTable.priority} = 'low' THEN 4
        ELSE 5
      END`,
      desc(reviewsTable.reviewDate),
    ];
  } else if (options.sortBy === 'rating') {
    order = [asc(reviewsTable.rating), desc(reviewsTable.reviewDate)];
  } else {
    order = [desc(reviewsTable.reviewDate)];
  }

  // Fetch reviews matching conditions
  const rows = await db
    .select()
    .from(reviewsTable)
    .where(and(...conditions))
    .orderBy(...order)
    .limit(limitVal)
    .offset(offsetVal);

  // Fetch total count matching conditions
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(reviewsTable)
    .where(and(...conditions));

  const totalCount = countRow?.count ?? 0;

  return {
    reviews: rows,
    totalCount,
    limit: limitVal,
    offset: offsetVal,
  };
}
