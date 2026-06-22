import { and, eq, isNull, sql, inArray } from 'drizzle-orm';

import { AI_CONFIG, llmClient } from '@review-engine/ai';
import {
  db,
  reviews as reviewsTable,
  reviewEmbeddings as embeddingsTable,
} from '@review-engine/database';

export interface EmbeddingResult {
  generated: number;
  dimensions: number;
  model: string;
  latencyMs: number;
  message?: string;
}

export interface SemanticSearchResult {
  id: string;
  text: string;
  title: string | null;
  rating: number | null;
  sentiment: string | null;
  theme: string | null;
  subTheme: string | null;
  priority: string | null;
  summary: string | null;
  source: string;
  reviewDate: Date;
  similarity: number;
}

export interface EmbeddingStats {
  totalEmbedded: number;
  totalUnembedded: number;
  embeddingModel: string;
  dimensions: number;
}

/**
 * Generates vector embeddings for processed reviews that don't have them yet.
 */
export async function generateEmbeddings(
  projectId: string,
  batchSize?: number
): Promise<EmbeddingResult> {
  const startTime = Date.now();
  const limitVal = batchSize ?? AI_CONFIG.EMBEDDING_BATCH_SIZE;

  // Find completed reviews that don't have an embedding yet
  const reviewsToEmbed = await db
    .select({
      id: reviewsTable.id,
      text: reviewsTable.reviewText,
    })
    .from(reviewsTable)
    .leftJoin(embeddingsTable, eq(reviewsTable.id, embeddingsTable.reviewId))
    .where(
      and(
        eq(reviewsTable.projectId, projectId),
        eq(reviewsTable.processingStatus, 'completed'),
        isNull(embeddingsTable.id)
      )
    )
    .limit(limitVal);

  if (reviewsToEmbed.length === 0) {
    return {
      generated: 0,
      dimensions: AI_CONFIG.EMBEDDING_DIMENSIONS,
      model: AI_CONFIG.EMBEDDING_MODEL,
      latencyMs: Date.now() - startTime,
      message: 'No reviews need embeddings',
    };
  }

  // Extract and truncate text (e.g. limit to 512 words as approximation of tokens)
  const texts = reviewsToEmbed.map((r) => {
    return r.text.split(/\s+/).slice(0, 512).join(' ');
  });

  // Call the embedding API (local model)
  const response = await llmClient.embed(texts);

  // Batch insert ALL vectors in a single SQL statement
  const insertData: Array<{ reviewId: string; embedding: number[] }> = [];
  for (let i = 0; i < reviewsToEmbed.length; i++) {
    const embedding = response.embeddings[i];
    if (!embedding) continue;
    insertData.push({ reviewId: reviewsToEmbed[i]!.id, embedding });
  }

  if (insertData.length > 0) {
    const valueRows = insertData
      .map(
        (d) =>
          `('${d.reviewId}', '${projectId}', '${AI_CONFIG.EMBEDDING_MODEL}', ${AI_CONFIG.EMBEDDING_DIMENSIONS}, '[${d.embedding.join(',')}]'::vector)`
      )
      .join(',');

    await db.execute(sql`
      INSERT INTO review_embeddings (review_id, project_id, embedding_model, dimensions, embedding)
      VALUES ${sql.raw(valueRows)}
      ON CONFLICT (review_id) DO NOTHING
    `);
  }

  return {
    generated: reviewsToEmbed.length,
    dimensions: AI_CONFIG.EMBEDDING_DIMENSIONS,
    model: AI_CONFIG.EMBEDDING_MODEL,
    latencyMs: Date.now() - startTime,
  };
}

/**
 * Searches for the most semantically similar reviews based on cosine similarity.
 */
export async function semanticSearch(
  projectId: string,
  query: string,
  limit?: number
): Promise<SemanticSearchResult[]> {
  const limitVal = limit ?? 10;

  // Generate embedding for the query
  const response = await llmClient.embed([query]);
  const queryEmbedding = response.embeddings[0];

  if (!queryEmbedding) {
    return [];
  }

  const queryVectorStr = `[${queryEmbedding.join(',')}]`;

  // Search using pgvector distance operator <=>
  const results = await db.execute(sql`
    SELECT
      r.id,
      r.review_text as "text",
      r.review_title as "title",
      r.rating,
      r.sentiment,
      r.theme,
      r.sub_theme as "subTheme",
      r.priority,
      r.ai_summary as "summary",
      r.source,
      r.review_date as "reviewDate",
      (1 - (re.embedding <=> ${queryVectorStr}::vector))::double precision as similarity
    FROM review_embeddings re
    JOIN reviews r ON r.id = re.review_id
    WHERE re.project_id = ${projectId}
    ORDER BY re.embedding <=> ${queryVectorStr}::vector
    LIMIT ${limitVal}
  `);

  return (
    results as unknown as Array<{
      id: string;
      text: string;
      title: string | null;
      rating: number | null;
      sentiment: string | null;
      theme: string | null;
      subTheme: string | null;
      priority: string | null;
      summary: string | null;
      source: string;
      reviewDate: string | Date;
      similarity: number;
    }>
  ).map((row) => ({
    id: row.id,
    text: row.text,
    title: row.title,
    rating: row.rating ? Number(row.rating) : null,
    sentiment: row.sentiment,
    theme: row.theme,
    subTheme: row.subTheme,
    priority: row.priority,
    summary: row.summary,
    source: row.source,
    reviewDate: new Date(row.reviewDate),
    similarity: Number(row.similarity),
  }));
}

/**
 * Generates embeddings for specific reviews by ID.
 * Used after AI processing to immediately create embeddings for freshly analyzed reviews.
 */
export async function generateForReviews(
  projectId: string,
  reviewIds: string[]
): Promise<{ generated: number }> {
  if (reviewIds.length === 0) return { generated: 0 };

  // Find which of the given reviews still need embeddings
  const reviewsToEmbed = await db
    .select({
      id: reviewsTable.id,
      text: reviewsTable.reviewText,
    })
    .from(reviewsTable)
    .leftJoin(embeddingsTable, eq(reviewsTable.id, embeddingsTable.reviewId))
    .where(
      and(
        eq(reviewsTable.projectId, projectId),
        inArray(reviewsTable.id, reviewIds),
        isNull(embeddingsTable.id)
      )
    );

  if (reviewsToEmbed.length === 0) return { generated: 0 };

  const BATCH_SIZE = 20;
  let generated = 0;

  for (let i = 0; i < reviewsToEmbed.length; i += BATCH_SIZE) {
    const batch = reviewsToEmbed.slice(i, i + BATCH_SIZE);
    const texts = batch.map((r) => r.text.split(/\s+/).slice(0, 512).join(' '));

    const response = await llmClient.embed(texts);

    // Batch insert ALL vectors in a single SQL statement per batch
    const insertData: Array<{ reviewId: string; embedding: number[] }> = [];
    for (let j = 0; j < batch.length; j++) {
      const embedding = response.embeddings[j];
      if (!embedding) continue;
      insertData.push({ reviewId: batch[j]!.id, embedding });
    }

    if (insertData.length > 0) {
      const valueRows = insertData
        .map(
          (d) =>
            `('${d.reviewId}', '${projectId}', '${AI_CONFIG.EMBEDDING_MODEL}', ${AI_CONFIG.EMBEDDING_DIMENSIONS}, '[${d.embedding.join(',')}]'::vector)`
        )
        .join(',');

      await db.execute(sql`
        INSERT INTO review_embeddings (review_id, project_id, embedding_model, dimensions, embedding)
        VALUES ${sql.raw(valueRows)}
        ON CONFLICT (review_id) DO NOTHING
      `);
      generated += insertData.length;
    }
  }

  return { generated };
}

/**
 * Retrieves the embedding status metrics for a project.
 */
export async function getEmbeddingStats(projectId: string): Promise<EmbeddingStats> {
  const [embeddedCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(reviewsTable)
    .innerJoin(embeddingsTable, eq(reviewsTable.id, embeddingsTable.reviewId))
    .where(eq(reviewsTable.projectId, projectId));

  const [unembeddedCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(reviewsTable)
    .leftJoin(embeddingsTable, eq(reviewsTable.id, embeddingsTable.reviewId))
    .where(and(eq(reviewsTable.projectId, projectId), isNull(embeddingsTable.id)));

  return {
    totalEmbedded: embeddedCountRow?.count ?? 0,
    totalUnembedded: unembeddedCountRow?.count ?? 0,
    embeddingModel: AI_CONFIG.EMBEDDING_MODEL,
    dimensions: AI_CONFIG.EMBEDDING_DIMENSIONS,
  };
}
