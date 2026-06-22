import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

import { llmClient, AI_CONFIG } from '@review-engine/ai';
import { db, reviewEmbeddings as embeddingsTable } from '@review-engine/database';

import {
  createTestDb,
  resetTestDb,
  createTestUser,
  createTestProject,
  createTestReview,
} from '../../../__tests__/helpers/test-utils.js';
import * as embeddingService from '../embedding.service.js';

// Mock the LLM client's embed method
vi.mock('@review-engine/ai', async (importOriginal) => {
  const original = await importOriginal<typeof import('@review-engine/ai')>();
  return {
    ...original,
    llmClient: {
      ...original.llmClient,
      embed: vi.fn(),
    },
  };
});

describe('Embeddings Module', () => {
  beforeAll(async () => {
    await createTestDb();
    await resetTestDb();
  });

  afterAll(async () => {
    await resetTestDb();
    vi.restoreAllMocks();
  });

  it('should generate embeddings for completed reviews and support semantic search + stats', async () => {
    const user = await createTestUser({ email: 'embeddings-test-admin@test.com' });
    const project = await createTestProject(user.id);

    // Create 2 completed reviews and 1 pending review
    const r1 = await createTestReview(project.id, {
      reviewText: 'This product is exceptionally good, I love the UI design!',
      rating: 5,
      processingStatus: 'completed',
    });

    const r2 = await createTestReview(project.id, {
      reviewText: 'Payment failed repeatedly and I was double charged.',
      rating: 1,
      processingStatus: 'completed',
    });

    await createTestReview(project.id, {
      reviewText: 'Pending review that should not be embedded yet.',
      rating: 3,
      processingStatus: 'pending',
    });

    // Mock embedding output (Xenova/all-MiniLM-L6-v2 uses 384 dimensions)
    const mockEmbedding1 = Array.from({ length: 384 }, (_, idx) => (idx === 0 ? 0.9 : 0.01));
    const mockEmbedding2 = Array.from({ length: 384 }, (_, idx) => (idx === 0 ? -0.9 : 0.01));

    vi.mocked(llmClient.embed).mockResolvedValueOnce({
      embeddings: [mockEmbedding1, mockEmbedding2],
      model: AI_CONFIG.EMBEDDING_MODEL,
      provider: 'local',
      usage: { totalTokens: 50 },
      cost: { totalCost: 0 },
      latencyMs: 30,
    });

    // 1. Generate Embeddings
    const generateResult = await embeddingService.generateEmbeddings(project.id);
    expect(generateResult.generated).toBe(2);
    expect(generateResult.dimensions).toBe(384);
    expect(generateResult.model).toBe(AI_CONFIG.EMBEDDING_MODEL);

    // Verify DB insertion
    const dbEmbeddings = await db.select().from(embeddingsTable);
    expect(dbEmbeddings).toHaveLength(2);
    expect(dbEmbeddings.map((e) => e.reviewId)).toContain(r1.id);
    expect(dbEmbeddings.map((e) => e.reviewId)).toContain(r2.id);

    // 2. Get Stats
    const stats = await embeddingService.getEmbeddingStats(project.id);
    expect(stats.totalEmbedded).toBe(2);
    expect(stats.totalUnembedded).toBe(1); // The pending review is unembedded
    expect(stats.dimensions).toBe(384);

    // Mock embedding for a query (simulating query "UI is great")
    const mockQueryEmbedding = Array.from({ length: 384 }, (_, idx) => (idx === 0 ? 0.85 : 0.01));
    vi.mocked(llmClient.embed).mockResolvedValueOnce({
      embeddings: [mockQueryEmbedding],
      model: AI_CONFIG.EMBEDDING_MODEL,
      provider: 'local',
      usage: { totalTokens: 5 },
      cost: { totalCost: 0 },
      latencyMs: 10,
    });

    // 3. Semantic Search
    const searchResults = await embeddingService.semanticSearch(project.id, 'UI is great', 2);
    expect(searchResults).toHaveLength(2);
    // The first review (r1) should match closer because mockEmbedding1 first dimension is positive 0.9, while mockEmbedding2 is negative -0.9
    expect(searchResults[0]?.id).toBe(r1.id);
    expect(searchResults[0]?.similarity).toBeGreaterThan(0.9);
    expect(searchResults[1]?.id).toBe(r2.id);
    expect(searchResults[1]?.similarity).toBeLessThan(0);
  });
});
