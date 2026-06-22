import 'dotenv/config';
import {
  db,
  reviews as reviewsTable,
  reviewEmbeddings as embeddingsTable,
} from '../packages/database/src/index.ts';
import { llmClient, AI_CONFIG } from '../packages/ai/src/index.ts';
import { eq, and, sql, isNull } from 'drizzle-orm';

async function main() {
  console.log('Fetching reviews needing embeddings...');
  const reviewsToEmbed = await db
    .select({
      id: reviewsTable.id,
      text: reviewsTable.reviewText,
      projectId: reviewsTable.projectId,
    })
    .from(reviewsTable)
    .leftJoin(embeddingsTable, eq(reviewsTable.id, embeddingsTable.reviewId))
    .where(and(eq(reviewsTable.processingStatus, 'completed'), isNull(embeddingsTable.id)));

  console.log(`Found ${reviewsToEmbed.length} reviews that need embeddings.`);
  if (reviewsToEmbed.length === 0) {
    console.log('All completed reviews already have embeddings!');
    process.exit(0);
  }

  const BATCH_SIZE = 20;
  let totalGenerated = 0;

  for (let i = 0; i < reviewsToEmbed.length; i += BATCH_SIZE) {
    const batch = reviewsToEmbed.slice(i, i + BATCH_SIZE);
    const texts = batch.map((r) => r.text.split(/\s+/).slice(0, 512).join(' '));

    console.log(
      `Generating embeddings for batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} reviews)...`
    );
    try {
      const response = await llmClient.embed(texts);

      await db.transaction(async (tx) => {
        for (let j = 0; j < batch.length; j++) {
          const review = batch[j]!;
          const embedding = response.embeddings[j];
          if (!embedding) continue;

          const vectorStr = `[${embedding.join(',')}]`;

          await tx.execute(sql`
            INSERT INTO review_embeddings (review_id, project_id, embedding_model, dimensions, embedding)
            VALUES (${review.id}, ${review.projectId}, ${AI_CONFIG.EMBEDDING_MODEL}, ${AI_CONFIG.EMBEDDING_DIMENSIONS}, ${vectorStr}::vector)
            ON CONFLICT (review_id) DO NOTHING
          `);
          totalGenerated++;
        }
      });
      console.log(`Successfully generated and stored batch ${Math.floor(i / BATCH_SIZE) + 1}.`);
    } catch (err) {
      console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, (err as Error).message);
    }
  }

  console.log(`Finished! Generated and stored ${totalGenerated} review embeddings.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
