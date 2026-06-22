import { and, desc, eq, sql } from 'drizzle-orm';

import { AI_CONFIG, buildRagPrompt, llmClient, RAG_SYSTEM_PROMPT } from '@review-engine/ai';
import { db, chatMessages, reviews as reviewsTable } from '@review-engine/database';

import * as embeddingService from '../embeddings/embedding.service.js';
import type { SemanticSearchResult } from '../embeddings/embedding.service.js';

export interface ChatResponse {
  answer: string;
  sources: Array<{
    id: string;
    text: string;
    similarity: number;
    sentiment: string | null;
    source: string;
  }>;
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
  cost: { totalCost: number };
  latencyMs: number;
}

export interface ChatStats {
  totalMessages: number;
  totalCost: number;
  averageLatencyMs: number;
}

/**
 * Runs Retrieval-Augmented Generation (RAG) chat logic:
 * 1. Semantic search for context reviews.
 * 2. Pre-computes metrics breakdown.
 * 3. Sends prompt to LLM (DeepSeek).
 * 4. Stores the history and returns answers + citations.
 */
export async function chat(
  projectId: string,
  userId: string,
  question: string
): Promise<ChatResponse> {
  // Step 1: Try semantic search first (requires embeddings)
  let reviews = await embeddingService.semanticSearch(projectId, question, 20);

  // Step 2: If no embeddings exist, fall back to keyword search
  if (reviews.length === 0) {
    reviews = await keywordSearchReviews(projectId, question, 20);
  }

  // Step 3: If still nothing, check if any reviews exist at all
  if (reviews.length === 0) {
    const [reviewCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(reviewsTable)
      .where(eq(reviewsTable.projectId, projectId));

    if (!reviewCount || reviewCount.count === 0) {
      return {
        answer: 'No reviews found in this project yet. Please ingest and process reviews first.',
        sources: [],
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        cost: { totalCost: 0 },
        latencyMs: 0,
      };
    }

    // Get most recent reviews as context
    const recentReviews = await db
      .select({
        id: reviewsTable.id,
        text: reviewsTable.reviewText,
        sentiment: reviewsTable.sentiment,
        theme: reviewsTable.theme,
        source: reviewsTable.source,
        reviewDate: reviewsTable.reviewDate,
        rating: reviewsTable.rating,
      })
      .from(reviewsTable)
      .where(eq(reviewsTable.projectId, projectId))
      .orderBy(desc(reviewsTable.reviewDate))
      .limit(10);

    reviews = recentReviews.map((r) => ({
      id: r.id,
      text: r.text,
      title: null,
      rating: r.rating,
      sentiment: r.sentiment,
      theme: r.theme,
      subTheme: null,
      priority: null,
      summary: null,
      source: r.source,
      reviewDate: r.reviewDate,
      similarity: 0,
    }));
  }

  // Step 2: Build stats from retrieved reviews
  const sentimentBreakdown: Record<string, number> = {};
  const themeBreakdown: Record<string, number> = {};

  for (const r of reviews) {
    if (r.sentiment) {
      sentimentBreakdown[r.sentiment] = (sentimentBreakdown[r.sentiment] || 0) + 1;
    }
    if (r.theme) {
      themeBreakdown[r.theme] = (themeBreakdown[r.theme] || 0) + 1;
    }
  }

  const mappedReviews = reviews.map((r) => ({
    id: r.id,
    text: r.text,
    sentiment: r.sentiment || 'unknown',
    theme: r.theme || 'unknown',
    rating: r.rating || 0,
    date: r.reviewDate.toISOString().split('T')[0] || '',
  }));

  const stats = {
    totalRetrieved: reviews.length,
    sentimentBreakdown,
    themes: themeBreakdown,
  };

  // Step 3: Build context and call LLM
  const ragPrompt = buildRagPrompt(question, { reviews: mappedReviews, stats });

  const response = await llmClient.chat(
    [
      { role: 'system', content: RAG_SYSTEM_PROMPT },
      { role: 'user', content: ragPrompt },
    ],
    {
      temperature: AI_CONFIG.CHAT_TEMPERATURE,
      maxTokens: AI_CONFIG.CHAT_MAX_TOKENS,
    }
  );

  // Step 4: Store the conversation
  await db.insert(chatMessages).values({
    projectId,
    userId,
    role: 'user',
    content: question,
  });

  await db.insert(chatMessages).values({
    projectId,
    userId,
    role: 'assistant',
    content: response.content,
    metadata: {
      source_review_ids: reviews.map((r) => r.id),
      sources: reviews.slice(0, 5).map((r) => ({
        id: r.id,
        text: r.text.substring(0, 200) + (r.text.length > 200 ? '...' : ''),
        similarity: r.similarity,
        sentiment: r.sentiment,
        source: r.source,
      })),
      model: response.model,
      usage: response.usage,
      cost: response.cost,
      latency_ms: response.latencyMs,
    },
  });

  // Step 5: Return response
  return {
    answer: response.content,
    sources: reviews.slice(0, 5).map((r) => ({
      id: r.id,
      text: r.text.substring(0, 200) + (r.text.length > 200 ? '...' : ''),
      similarity: r.similarity,
      sentiment: r.sentiment,
      source: r.source,
    })),
    usage: response.usage,
    cost: response.cost,
    latencyMs: response.latencyMs,
  };
}

/**
 * Keyword-based fallback search when no embeddings exist for semantic search.
 * Splits the question into keywords, searches reviews using ILIKE,
 * and returns results in SemanticSearchResult format.
 */
async function keywordSearchReviews(
  projectId: string,
  question: string,
  limit: number
): Promise<SemanticSearchResult[]> {
  // Split question into meaningful keywords (words longer than 3 chars)
  const keywords = question
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);

  if (keywords.length === 0) {
    return [];
  }

  // Build ILIKE conditions for each keyword
  const conditions = keywords.map(
    (k) => sql`LOWER(${reviewsTable.reviewText}) LIKE ${'%' + k + '%'}`
  );
  const whereCondition = conditions.reduce((acc, cond) => sql`${acc} OR ${cond}`);

  try {
    const results = await db
      .select({
        id: reviewsTable.id,
        text: reviewsTable.reviewText,
        title: reviewsTable.reviewTitle,
        rating: reviewsTable.rating,
        sentiment: reviewsTable.sentiment,
        theme: reviewsTable.theme,
        subTheme: reviewsTable.subTheme,
        priority: reviewsTable.priority,
        summary: reviewsTable.aiSummary,
        source: reviewsTable.source,
        reviewDate: reviewsTable.reviewDate,
      })
      .from(reviewsTable)
      .where(and(eq(reviewsTable.projectId, projectId), whereCondition))
      .orderBy(desc(reviewsTable.reviewDate))
      .limit(limit);

    return results.map((r) => ({
      id: r.id,
      text: r.text,
      title: r.title,
      rating: r.rating,
      sentiment: r.sentiment,
      theme: r.theme,
      subTheme: r.subTheme,
      priority: r.priority,
      summary: r.summary,
      source: r.source,
      reviewDate: r.reviewDate,
      similarity: 0, // No similarity score for keyword search
    }));
  } catch (err) {
    console.error('Keyword search failed, falling back to recent reviews:', (err as Error).message);
    return [];
  }
}

/**
 * Retrieves chat message logs for a user/project.
 */
export async function getChatHistory(projectId: string, userId: string, limit = 50) {
  return db
    .select()
    .from(chatMessages)
    .where(and(eq(chatMessages.projectId, projectId), eq(chatMessages.userId, userId)))
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit);
}

/**
 * Aggregates statistics about the project's RAG chat usage.
 */
export async function getProjectChatStats(projectId: string): Promise<ChatStats> {
  const [totalCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(chatMessages)
    .where(eq(chatMessages.projectId, projectId));
  const totalMessages = totalCountRow?.count ?? 0;

  const assistantMessages = await db
    .select({
      metadata: chatMessages.metadata,
    })
    .from(chatMessages)
    .where(and(eq(chatMessages.projectId, projectId), eq(chatMessages.role, 'assistant')));

  let totalCost = 0;
  let totalLatency = 0;
  let assistantCount = 0;

  for (const msg of assistantMessages) {
    const meta = msg.metadata as { cost?: { totalCost?: number }; latency_ms?: number } | null;
    if (meta) {
      if (meta.cost?.totalCost) {
        totalCost += meta.cost.totalCost;
      }
      if (meta.latency_ms) {
        totalLatency += meta.latency_ms;
        assistantCount++;
      }
    }
  }

  const averageLatencyMs = assistantCount > 0 ? Math.round(totalLatency / assistantCount) : 0;

  return {
    totalMessages,
    totalCost,
    averageLatencyMs,
  };
}
