/* eslint-disable no-console */
import 'dotenv/config';
import { eq, and, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from '../packages/database/src/schema/index.js';
import {
  reviews as reviewsTable,
  reviewEmbeddings,
} from '../packages/database/src/schema/index.js';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL required');
    process.exit(1);
  }

  const { llmClient, AI_CONFIG } = await import('../packages/ai/src/index.js');

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });

  console.log('Starting embedding generation...');

  const needsEmbeddings = await db
    .select({ id: reviewsTable.id, text: reviewsTable.reviewText })
    .from(reviewsTable)
    .leftJoin(reviewEmbeddings, eq(reviewsTable.id, reviewEmbeddings.reviewId))
    .where(and(eq(reviewsTable.processingStatus, 'completed'), sql`${reviewEmbeddings.id} IS NULL`))
    .limit(100);

  console.log(`Found ${needsEmbeddings.length} reviews needing embeddings`);
  if (needsEmbeddings.length === 0) {
    console.log('All reviews have embeddings');
    await pool.end();
    process.exit(0);
  }

  const BATCH_SIZE = 20;
  let totalGenerated = 0;

  for (let i = 0; i < needsEmbeddings.length; i += BATCH_SIZE) {
    const batch = needsEmbeddings.slice(i, i + BATCH_SIZE);
    try {
      const response = await llmClient.embed(batch.map((r) => r.text.substring(0, 512)));
      for (let j = 0; j < batch.length; j++) {
        const embedding = response.embeddings[j];
        if (!embedding) continue;
        await pool.query(
          `INSERT INTO review_embeddings (review_id, project_id, embedding_model, dimensions, embedding) VALUES ($1, (SELECT project_id FROM reviews WHERE id = $1), $2, $3, $4::vector) ON CONFLICT (review_id) DO NOTHING`,
          [
            batch[j].id,
            AI_CONFIG.EMBEDDING_MODEL,
            AI_CONFIG.EMBEDDING_DIMENSIONS,
            `[${embedding.join(',')}]`,
          ]
        );
        totalGenerated++;
      }
      console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} embeddings`);
    } catch (err) {
      console.error(`Batch failed:`, (err as Error).message);
    }
  }

  console.log(
    `SUMMARY: ${totalGenerated} embeddings (${AI_CONFIG.EMBEDDING_DIMENSIONS}d, local, $0 cost)`
  );
  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
