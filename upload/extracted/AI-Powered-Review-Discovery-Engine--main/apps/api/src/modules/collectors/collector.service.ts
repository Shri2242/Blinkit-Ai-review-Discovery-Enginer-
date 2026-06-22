import crypto from 'crypto';

import { eq, and, inArray } from 'drizzle-orm';

import {
  db,
  collectorSources,
  collectorLogs,
  reviews as reviewsTable,
  activityLog,
} from '@review-engine/database';

import {
  collectGooglePlayReviews,
  collectAppStoreReviews,
  collectRedditPosts,
  collectTweets,
  type CollectedReview,
} from './sources/index.js';

export const SOURCE_TYPES = ['google_play', 'app_store', 'reddit', 'twitter'] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

interface CreateSourceInput {
  sourceType: SourceType;
  name: string;
  config: Record<string, unknown>;
  schedule?: string;
}

class CollectorService {
  async validateSourceConfig(_sourceType: string, _config: unknown): Promise<boolean> {
    return true;
  }

  async createSource(projectId: string, input: CreateSourceInput) {
    const [source] = await db
      .insert(collectorSources)
      .values({
        project_id: projectId,
        source_type: input.sourceType,
        name: input.name,
        config: input.config,
        schedule: input.schedule || '0 9 * * *',
      })
      .returning();

    await db.insert(activityLog).values({
      projectId: projectId,
      action: 'collector.created',
      details: { sourceId: source!.id, sourceType: input.sourceType },
    });

    return source;
  }

  async listSources(projectId: string) {
    return db
      .select()
      .from(collectorSources)
      .where(eq(collectorSources.project_id, projectId))
      .orderBy(collectorSources.created_at);
  }

  async updateSource(projectId: string, sourceId: string, data: Partial<CreateSourceInput>) {
    const [updated] = await db
      .update(collectorSources)
      .set({
        ...(data.name !== undefined && { name: data.name }),
        ...(data.config !== undefined && { config: data.config }),
        ...(data.schedule !== undefined && { schedule: data.schedule }),
        ...(data.sourceType !== undefined && { source_type: data.sourceType }),
        updated_at: new Date(),
      })
      .where(and(eq(collectorSources.id, sourceId), eq(collectorSources.project_id, projectId)))
      .returning();

    if (!updated) throw new Error('Source not found');
    return updated;
  }

  async toggleSource(projectId: string, sourceId: string, enabled: boolean) {
    await db
      .update(collectorSources)
      .set({ enabled, updated_at: new Date() })
      .where(and(eq(collectorSources.id, sourceId), eq(collectorSources.project_id, projectId)));
  }

  async deleteSource(projectId: string, sourceId: string) {
    await db
      .delete(collectorSources)
      .where(and(eq(collectorSources.id, sourceId), eq(collectorSources.project_id, projectId)));
  }

  async getCollectionLogs(sourceId: string, limit = 20) {
    return db
      .select()
      .from(collectorLogs)
      .where(eq(collectorLogs.source_id, sourceId))
      .orderBy(collectorLogs.started_at)
      .limit(limit);
  }

  async runCollection(
    projectId: string,
    sourceId: string
  ): Promise<{
    fetched: number;
    inserted: number;
    duplicates: number;
    status: string;
  }> {
    const [source] = await db
      .select()
      .from(collectorSources)
      .where(eq(collectorSources.id, sourceId));

    if (!source) throw new Error('Collector source not found');

    const startTime = Date.now();

    const [log] = await db
      .insert(collectorLogs)
      .values({ source_id: sourceId, status: 'running', started_at: new Date() })
      .returning();

    try {
      let collected: CollectedReview[] = [];
      const config = source.config as Record<string, unknown>;

      switch (source.source_type) {
        case 'google_play':
          collected = await collectGooglePlayReviews(
            config as { appId: string; lang?: string; country?: string; maxReviews?: number }
          );
          break;
        case 'app_store':
          collected = await collectAppStoreReviews(
            config as { appId: string; country?: string; maxReviews?: number }
          );
          break;
        case 'reddit':
          collected = await collectRedditPosts(
            config as { subreddit: string; queries?: string[]; maxPosts?: number }
          );
          break;
        case 'twitter':
          collected = await collectTweets(
            config as { queries: string[]; maxTweets?: number; apifyApiKey?: string }
          );
          break;
        default:
          throw new Error(`Unknown source type: ${source.source_type}`);
      }

      let inserted = 0;
      let skipped = 0;

      // Batch deduplication: fetch all existing source_review_ids in ONE query
      const externalIds = collected.filter((r) => r.externalId).map((r) => r.externalId!);

      const existingRows =
        externalIds.length > 0
          ? await db
              .select({ sourceReviewId: reviewsTable.sourceReviewId })
              .from(reviewsTable)
              .where(
                and(
                  eq(reviewsTable.projectId, projectId),
                  inArray(reviewsTable.sourceReviewId, externalIds)
                )
              )
          : [];

      const existingSet = new Set(existingRows.map((r) => r.sourceReviewId));

      // Filter to only new reviews
      const newReviews = collected
        .filter((r) => r.text.trim() && (!r.externalId || !existingSet.has(r.externalId)))
        .map((review) => ({
          projectId: projectId,
          reviewText: review.text.trim(),
          rating: review.rating,
          reviewTitle: review.title,
          reviewDate: review.date,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          source: review.source as any,
          authorName: review.author,
          sourceReviewId: review.externalId,
          contentHash: crypto.createHash('sha256').update(review.text).digest('hex'),
          processingStatus: 'pending' as const,
        }));

      // Batch insert in chunks of 50 (avoids query size limits)
      const BATCH_SIZE = 50;
      for (let i = 0; i < newReviews.length; i += BATCH_SIZE) {
        const batch = newReviews.slice(i, i + BATCH_SIZE);
        await db.insert(reviewsTable).values(batch);
        inserted += batch.length;
      }

      skipped = collected.length - newReviews.length;

      const duration = Date.now() - startTime;
      const status = inserted === 0 && collected.length > 0 ? 'partial' : 'success';

      await db
        .update(collectorLogs)
        .set({
          status,
          reviews_fetched: collected.length,
          reviews_new: inserted,
          reviews_duplicate: skipped,
          duration_ms: duration,
          completed_at: new Date(),
        })
        .where(eq(collectorLogs.id, log!.id));

      await db
        .update(collectorSources)
        .set({
          last_run_at: new Date(),
          last_run_status: status,
          last_run_count: inserted,
          total_collected: (source.total_collected || 0) + inserted,
          error_message: null,
          updated_at: new Date(),
        })
        .where(eq(collectorSources.id, sourceId));

      // Trigger automatic background AI processing!
      // This solves the issue where reviews just sit in "pending" status forever
      if (inserted > 0) {
        import('../ai-processor/processor.service.js')
          .then((processor) => {
            console.warn(
              `[Collector] Triggering background AI processing for project ${projectId}`
            );
            processor.processUnprocessedReviews(projectId, 1000).catch((err) => {
              console.error('[Collector] Background processing failed:', err);
            });
          })
          .catch((err) => {
            console.error('[Collector] Failed to load processor module:', err);
          });
      }

      return { fetched: collected.length, inserted, duplicates: skipped, status };
    } catch (err) {
      const errorMessage = (err as Error).message;

      await db
        .update(collectorLogs)
        .set({
          status: 'failed',
          duration_ms: Date.now() - startTime,
          error_message: errorMessage,
          completed_at: new Date(),
        })
        .where(eq(collectorLogs.id, log!.id));

      await db
        .update(collectorSources)
        .set({
          last_run_at: new Date(),
          last_run_status: 'failed',
          error_message: errorMessage,
          updated_at: new Date(),
        })
        .where(eq(collectorSources.id, sourceId));

      throw err;
    }
  }

  async runAllEnabledSources(projectId: string) {
    const sources = await db
      .select()
      .from(collectorSources)
      .where(and(eq(collectorSources.project_id, projectId), eq(collectorSources.enabled, true)));

    for (const source of sources) {
      try {
        await this.runCollection(projectId, source.id);
      } catch (err) {
        console.error(`Collection failed for ${source.id}:`, (err as Error).message);
      }
    }
  }
}

export const collectorService = new CollectorService();
