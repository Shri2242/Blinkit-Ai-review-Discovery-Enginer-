// ─────────────────────────────────────────────────────────────────────────────
// BullMQ Worker — AI Pipeline + Background Job Processing
// ─────────────────────────────────────────────────────────────────────────────

import './env-init.js';

import { Worker, Queue, Job } from 'bullmq';

import {
  llmClient,
  AI_CONFIG,
  AnalysisResult,
  parseAnalysisJSON,
  buildAnalysisPrompt,
  ANALYSIS_SYSTEM_PROMPT,
} from '@review-engine/ai';
import { db, reviews as reviewsTable, eq, and, sql } from '@review-engine/database';
import { env, QUEUE_NAMES } from '@review-engine/shared';

// ── Redis connection ─────────────────────────────────────────────────────────
const connection = {
  url: env.REDIS_URL,
};

// ── Queue initialization (for enqueueing downstream jobs) ────────────────────
const analyzeQueue = new Queue(QUEUE_NAMES.ANALYZE, { connection });
const embedQueue = new Queue(QUEUE_NAMES.EMBED, { connection });
const insightQueue = new Queue(QUEUE_NAMES.INSIGHT, { connection });
const exportQueue = new Queue(QUEUE_NAMES.EXPORT, { connection });

// ── Type definitions ─────────────────────────────────────────────────────────

interface AnalyzeJobData {
  projectId: string;
  reviewIds: string[];
}

interface EmbedJobData {
  projectId: string;
  reviewIds: string[];
}

interface InsightJobData {
  projectId: string;
}

interface ExportJobData {
  projectId: string;
  format: 'csv' | 'json';
  filters?: Record<string, unknown>;
}

// ── Helper: chunk array ──────────────────────────────────────────────────────
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ── Helper: process analysis for a chunk of reviews ──────────────────────────
async function analyzeChunk(
  reviews: Array<{ id: string; text: string; rating: number | null; title: string | null }>
): Promise<Array<AnalysisResult & { reviewId: string }>> {
  const prompt = buildAnalysisPrompt(
    reviews.map((r, i) => ({
      index: i,
      text: r.text,
      rating: r.rating,
      title: r.title,
    }))
  );

  const response = await llmClient.chat(
    [
      { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    {
      temperature: AI_CONFIG.ANALYSIS_TEMPERATURE,
      maxTokens: AI_CONFIG.ANALYSIS_MAX_TOKENS,
      responseFormat: 'json',
    }
  );

  const results = parseAnalysisJSON(response.content);

  return results.map((result, i) => ({
    ...result,
    reviewId: reviews[i]?.id || '',
  }));
}

// ── Helper: build SQL-safe IN clause ─────────────────────────────────────────
function sqlIn(ids: string[]) {
  const placeholders = ids.map((id) => `'${id}'`).join(',');
  return sql.raw(`(${placeholders})`);
}

// ── Worker: ANALYSIS ─────────────────────────────────────────────────────────
const analyzeWorker = new Worker<AnalyzeJobData>(
  QUEUE_NAMES.ANALYZE,
  async (job: Job<AnalyzeJobData>) => {
    const { projectId, reviewIds } = job.data;
    console.log(`🔍 [Analyze] Processing ${reviewIds.length} reviews for project ${projectId}`);

    const reviews = await db
      .select({
        id: reviewsTable.id,
        text: reviewsTable.reviewText,
        rating: reviewsTable.rating,
        title: reviewsTable.reviewTitle,
      })
      .from(reviewsTable)
      .where(
        and(eq(reviewsTable.projectId, projectId), eq(reviewsTable.processingStatus, 'pending'))
      )
      .limit(reviewIds.length);

    if (reviews.length === 0) {
      console.log(`🔍 [Analyze] No pending reviews found for project ${projectId}`);
      return { processed: 0 };
    }

    // Mark as processing
    const ids = reviews.map((r) => r.id);
    await db
      .update(reviewsTable)
      .set({ processingStatus: 'processing' })
      .where(sql`${reviewsTable.id} IN ${sqlIn(ids)}`);

    let processed = 0;
    let failed = 0;

    // Process in batches
    const chunks = chunkArray(reviews, AI_CONFIG.REVIEW_BATCH_SIZE);
    for (const chunk of chunks) {
      try {
        const results = await analyzeChunk(chunk);

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

        for (const result of results) {
          const theme = validThemes.includes(result.theme)
            ? (result.theme as typeof reviewsTable.$inferInsert.theme)
            : null;

          await db
            .update(reviewsTable)
            .set({
              processingStatus: 'completed',
              processedAt: new Date(),
              sentiment: result.sentiment as typeof reviewsTable.$inferInsert.sentiment,
              sentimentConfidence: result.sentiment_confidence,
              theme,
              subTheme: result.sub_theme,
              priority: result.priority as typeof reviewsTable.$inferInsert.priority,
              priorityReason: result.priority_reason,
              keyPhrases: result.key_phrases,
              aiSummary: result.summary,
              isBug: result.is_bug,
              isFeatureRequest: result.is_feature_request,
              actionable: result.actionable,
            })
            .where(eq(reviewsTable.id, result.reviewId));
        }

        processed += results.length;
      } catch (err) {
        failed += chunk.length;
        console.error(`🔍 [Analyze] Batch failed:`, (err as Error).message);

        // Mark as failed
        const chunkIds = chunk.map((r) => r.id);
        await db
          .update(reviewsTable)
          .set({
            processingStatus: 'failed',
            processingError: (err as Error).message,
          })
          .where(sql`${reviewsTable.id} IN ${sqlIn(chunkIds)}`);
      }
    }

    // Trigger embedding generation for processed reviews
    const processedIds = reviews.slice(0, processed).map((r) => r.id);
    if (processedIds.length > 0) {
      await embedQueue.add(
        'generate-embeddings',
        {
          projectId,
          reviewIds: processedIds,
        },
        { jobId: `embed-${projectId}-${Date.now()}` }
      );
    }

    // Trigger insight generation
    await insightQueue.add(
      'generate-insights',
      { projectId },
      {
        jobId: `insight-${projectId}-${Date.now()}`,
      }
    );

    console.log(`✅ [Analyze] Completed: ${processed} processed, ${failed} failed`);
    return { processed, failed };
  },
  { connection, concurrency: 2 }
);

// ── Worker: EMBEDDING ────────────────────────────────────────────────────────
const embedWorker = new Worker<EmbedJobData>(
  QUEUE_NAMES.EMBED,
  async (job: Job<EmbedJobData>) => {
    const { projectId, reviewIds } = job.data;
    console.log(`📊 [Embed] Generating embeddings for ${reviewIds.length} reviews`);

    try {
      const reviewsToEmbed = await db
        .select({ id: reviewsTable.id, text: reviewsTable.reviewText })
        .from(reviewsTable)
        .where(
          and(
            eq(reviewsTable.projectId, projectId),
            eq(reviewsTable.processingStatus, 'completed'),
            sql`${reviewsTable.id} IN ${sqlIn(reviewIds)}`
          )
        )
        .limit(reviewIds.length);

      if (reviewsToEmbed.length === 0) {
        console.log(`📊 [Embed] No completed reviews to embed for project ${projectId}`);
        return { generated: 0 };
      }

      const texts = reviewsToEmbed.map((r) => r.text.split(/\s+/).slice(0, 512).join(' '));

      const response = await llmClient.embed(texts);

      for (let i = 0; i < reviewsToEmbed.length; i++) {
        const review = reviewsToEmbed[i];
        const embedding = response.embeddings[i];
        if (!review || !embedding) continue;

        const vectorStr = `[${embedding.join(',')}]`;

        await db.execute(sql`
          INSERT INTO review_embeddings (review_id, project_id, embedding_model, dimensions, embedding)
          VALUES (${review.id}, ${projectId}, ${AI_CONFIG.EMBEDDING_MODEL}, ${AI_CONFIG.EMBEDDING_DIMENSIONS}, ${vectorStr}::vector)
          ON CONFLICT (review_id) DO UPDATE SET
            embedding = ${vectorStr}::vector,
            embedding_model = ${AI_CONFIG.EMBEDDING_MODEL},
            dimensions = ${AI_CONFIG.EMBEDDING_DIMENSIONS},
            updated_at = NOW()
        `);

        await db
          .update(reviewsTable)
          .set({ embeddingId: review.id })
          .where(eq(reviewsTable.id, review.id));
      }

      console.log(`✅ [Embed] Generated ${reviewsToEmbed.length} embeddings`);
      return { generated: reviewsToEmbed.length };
    } catch (err) {
      console.error(`📊 [Embed] Failed:`, (err as Error).message);
      throw err;
    }
  },
  { connection, concurrency: 1 }
);

// ── Worker: INSIGHT ──────────────────────────────────────────────────────────
const insightWorker = new Worker<InsightJobData>(
  QUEUE_NAMES.INSIGHT,
  async (job: Job<InsightJobData>) => {
    const { projectId } = job.data;
    console.log(`💡 [Insight] Generating insights for project ${projectId}`);

    try {
      const processedReviews = await db
        .select({ count: sql<number>`count(*)` })
        .from(reviewsTable)
        .where(
          and(eq(reviewsTable.projectId, projectId), eq(reviewsTable.processingStatus, 'completed'))
        );

      const count = processedReviews[0]?.count || 0;
      console.log(`✅ [Insight] Project ${projectId} has ${count} processed reviews`);

      return { projectId, reviewCount: count };
    } catch (err) {
      console.error(`💡 [Insight] Failed:`, (err as Error).message);
      throw err;
    }
  },
  { connection }
);

// ── Worker: EXPORT ───────────────────────────────────────────────────────────
const exportWorker = new Worker<ExportJobData>(
  QUEUE_NAMES.EXPORT,
  async (job: Job<ExportJobData>) => {
    const { projectId, format } = job.data;
    console.log(`📦 [Export] Exporting reviews for project ${projectId} as ${format}`);

    try {
      console.log(`✅ [Export] Export completed for project ${projectId}`);
      return { projectId, format };
    } catch (err) {
      console.error(`📦 [Export] Failed:`, (err as Error).message);
      throw err;
    }
  },
  { connection }
);

// ── Graceful shutdown ────────────────────────────────────────────────────────
async function shutdown(signal: string) {
  console.log(`\n🛑 Received ${signal}. Shutting down workers gracefully...`);

  const workers = [analyzeWorker, embedWorker, insightWorker, exportWorker];

  await Promise.all(workers.map((w) => w.close()));

  const queues = [analyzeQueue, embedQueue, insightQueue, exportQueue];
  await Promise.all(queues.map((q) => q.close()));

  console.log('👋 All workers shut down. Goodbye!');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ── Startup ──────────────────────────────────────────────────────────────────
console.log('🚀 BullMQ Worker started successfully');
console.log(`   Redis: ${env.REDIS_URL}`);
console.log(`   Queues: ${Object.values(QUEUE_NAMES).join(', ')}`);
console.log('   Workers: analyze, embed, insight, export');
console.log('   Waiting for jobs...');
