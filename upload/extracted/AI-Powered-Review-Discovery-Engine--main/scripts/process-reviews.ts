/* eslint-disable no-console */
import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from '../packages/database/src/schema/index.js';
import { reviews as reviewsTable } from '../packages/database/src/schema/index.js';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL required');
    process.exit(1);
  }

  const { llmClient, AI_CONFIG, buildAnalysisPrompt, ANALYSIS_SYSTEM_PROMPT, parseAnalysisJSON } =
    await import('../packages/ai/src/index.js');

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });

  console.log('Starting AI review processing...');

  const unprocessed = await db
    .select()
    .from(reviewsTable)
    .where(eq(reviewsTable.processingStatus, 'pending'))
    .orderBy(reviewsTable.createdAt)
    .limit(100);
  console.log(`Found ${unprocessed.length} unprocessed reviews`);

  if (unprocessed.length === 0) {
    console.log('Nothing to process');
    await pool.end();
    process.exit(0);
  }

  const BATCH_SIZE = AI_CONFIG.REVIEW_BATCH_SIZE;
  let totalProcessed = 0,
    totalFailed = 0;

  for (let i = 0; i < unprocessed.length; i += BATCH_SIZE) {
    const batch = unprocessed.slice(i, i + BATCH_SIZE);
    console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} reviews)`);

    try {
      const prompt = buildAnalysisPrompt(
        batch.map((r, idx) => ({
          index: idx,
          text: r.reviewText,
          rating: r.rating,
          title: r.reviewTitle,
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

      for (const result of results) {
        const review = batch[result.review_index];
        if (!review) continue;
        try {
          await db
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
              processedAt: new Date(),
            })
            .where(eq(reviewsTable.id, review.id));
          totalProcessed++;
        } catch {
          totalFailed++;
        }
      }

      console.log(
        `Batch done: $${response.cost.totalCost.toFixed(4)} | ${response.usage.totalTokens} tokens`
      );
    } catch (err) {
      console.error(`Batch failed:`, (err as Error).message);
      totalFailed += batch.length;
    }
  }

  console.log(`SUMMARY: ${totalProcessed} processed, ${totalFailed} failed`);
  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
