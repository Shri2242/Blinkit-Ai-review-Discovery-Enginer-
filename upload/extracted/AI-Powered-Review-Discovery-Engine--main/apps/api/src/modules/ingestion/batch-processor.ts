import crypto from 'crypto';

import { and, eq } from 'drizzle-orm';

import { db as dbClient, reviews as reviewsTable } from '@review-engine/database';

import { NormalizedReview } from './file-parser.js';

type Database = typeof dbClient;

/**
 * Processes a batch of normalized reviews, performing bulk insertion with optional deduplication.
 */
export async function processBatch(
  db: Database,
  projectId: string,
  batchId: string,
  reviews: NormalizedReview[],
  opts?: { skipDuplicates?: boolean }
): Promise<{ inserted: number; skipped: number; errors: string[] }> {
  const skipDuplicates = opts?.skipDuplicates ?? true;
  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  const validSources = ['csv_upload', 'app_store', 'google_play', 'g2', 'trustpilot', 'manual'];

  // Process in chunks of 100 to avoid massive queries / database lockups
  const CHUNK_SIZE = 100;
  for (let i = 0; i < reviews.length; i += CHUNK_SIZE) {
    const chunk = reviews.slice(i, i + CHUNK_SIZE);

    for (const review of chunk) {
      const globalRowIndex = i + chunk.indexOf(review) + 1;
      try {
        // Check for duplicates if externalId is provided
        if (skipDuplicates && review.externalId) {
          const existing = await db.query.reviews.findFirst({
            where: and(
              eq(reviewsTable.projectId, projectId),
              eq(reviewsTable.sourceReviewId, review.externalId)
            ),
          });
          if (existing) {
            skipped++;
            continue;
          }
        }

        // Validate source enum
        const reviewSource = validSources.includes(review.source)
          ? (review.source as typeof reviewsTable.$inferInsert.source)
          : 'csv_upload';

        // Compute content hash (required field)
        const contentHash = crypto.createHash('sha256').update(review.text).digest('hex');

        // Insert into database
        await db.insert(reviewsTable).values({
          projectId,
          uploadBatchId: batchId,
          reviewText: review.text,
          rating: review.rating,
          reviewTitle: review.title,
          reviewDate: review.date,
          source: reviewSource,
          authorName: review.author,
          sourceReviewId: review.externalId,
          contentHash,
          processingStatus: 'pending',
        });

        inserted++;
      } catch (err) {
        errors.push(`Row ${globalRowIndex}: ${(err as Error).message}`);
      }
    }
  }

  return { inserted, skipped, errors };
}
