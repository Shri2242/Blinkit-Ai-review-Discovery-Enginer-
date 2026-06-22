import { eq, desc } from 'drizzle-orm';

import { db, uploadBatches, reviews, activityLog } from '@review-engine/database';

import { processBatch } from './batch-processor.js';
import { parseReviewsFile, normalizeReview, NormalizedReview } from './file-parser.js';
import { NotFoundError } from '../../lib/errors.js';
import * as webhookService from '../reports/webhook.service.js';

export interface IngestionResult {
  batchId: string;
  totalRows: number;
  inserted: number;
  skipped: number;
  errors: string[];
  status: 'completed' | 'failed';
}

/**
 * Ingests reviews from a CSV or JSON file.
 */
export async function ingestFromFile(
  projectId: string,
  userId: string,
  file: { path: string; mimetype: string; size: number; originalname?: string }
): Promise<IngestionResult> {
  // 1. Parse the file
  const rawReviews = await parseReviewsFile(file.path, file.mimetype, file.originalname);

  const normalizedReviews: NormalizedReview[] = [];
  const errors: string[] = [];

  // 2. Normalize all reviews (catch and collect normalization errors)
  rawReviews.forEach((raw, index) => {
    try {
      const normalized = normalizeReview(raw, index);
      normalizedReviews.push(normalized);
    } catch (err) {
      errors.push(`Row ${index + 1}: ${(err as Error).message}`);
    }
  });

  // 3. Create an upload_batch record
  const [batch] = await db
    .insert(uploadBatches)
    .values({
      projectId,
      uploadedBy: userId,
      filename: file.originalname || 'upload',
      source: 'csv_upload',
      totalRows: rawReviews.length,
      processedRows: 0,
      failedRows: 0,
      status: 'processing',
      startedAt: new Date(),
    })
    .returning();

  if (!batch) {
    throw new Error('Failed to create upload batch');
  }

  const batchId = batch.id;
  let inserted = 0;
  let skipped = 0;

  // 4. Process the batch if we have any valid normalized reviews
  if (normalizedReviews.length > 0) {
    const processResult = await processBatch(db, projectId, batchId, normalizedReviews, {
      skipDuplicates: true,
    });
    inserted = processResult.inserted;
    skipped = processResult.skipped;
    errors.push(...processResult.errors);
  }

  const finalFailedCount = errors.length;
  const status = finalFailedCount === rawReviews.length ? 'failed' : 'completed';

  // 5. Update the upload_batch record with results
  await db
    .update(uploadBatches)
    .set({
      processedRows: inserted,
      failedRows: finalFailedCount,
      status,
      errorLog: errors,
      completedAt: new Date(),
    })
    .where(eq(uploadBatches.id, batchId));

  // 6. Log activity
  await db.insert(activityLog).values({
    userId,
    projectId,
    action: 'reviews.ingested',
    entityType: 'upload_batch',
    entityId: batchId,
    details: { batchId, inserted, skipped, errors: finalFailedCount },
  });

  // Trigger automatic background AI processing!
  if (inserted > 0) {
    import('../ai-processor/processor.service.js')
      .then((processor) => {
        console.warn(`[Ingestion] Triggering background AI processing for project ${projectId}`);
        processor.processUnprocessedReviews(projectId, 1000).catch((err) => {
          console.error('[Ingestion] Background processing failed:', err);
        });
      })
      .catch((err) => {
        console.error('[Ingestion] Failed to load processor module:', err);
      });

    // Also trigger embedding generation after a delay to let AI processing start first
    setTimeout(() => {
      import('../embeddings/embedding.service.js')
        .then((emb) => emb.generateEmbeddings(projectId))
        .catch((err) => console.error('[Ingestion] Embedding generation trigger failed:', err));
    }, 5000);
  }

  // 7. Trigger webhook
  webhookService
    .triggerWebhooks(projectId, 'review.ingested', { batchId, inserted, skipped })
    .catch((err) => console.error('Error triggering review.ingested webhook:', err));

  return {
    batchId,
    totalRows: rawReviews.length,
    inserted,
    skipped,
    errors,
    status,
  };
}

/**
 * Gets the upload history for a project.
 */
export async function getUploadHistory(projectId: string) {
  return db
    .select()
    .from(uploadBatches)
    .where(eq(uploadBatches.projectId, projectId))
    .orderBy(desc(uploadBatches.createdAt));
}

/**
 * Gets details of a specific batch including its reviews.
 */
export async function getBatchDetails(batchId: string) {
  const [batch] = await db
    .select()
    .from(uploadBatches)
    .where(eq(uploadBatches.id, batchId))
    .limit(1);

  if (!batch) {
    throw new NotFoundError('Upload batch not found');
  }

  // Get reviews in this batch, limit to 1000
  const batchReviews = await db
    .select()
    .from(reviews)
    .where(eq(reviews.uploadBatchId, batchId))
    .limit(1000);

  // Map reviews back to the format the frontend or controller expects if needed
  return {
    batch,
    reviews: batchReviews,
  };
}
