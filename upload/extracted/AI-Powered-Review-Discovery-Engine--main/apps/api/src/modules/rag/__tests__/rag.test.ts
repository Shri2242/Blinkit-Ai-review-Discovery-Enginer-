import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

import { llmClient, AI_CONFIG } from '@review-engine/ai';
import { db, chatMessages } from '@review-engine/database';

import {
  createTestDb,
  resetTestDb,
  createTestUser,
  createTestProject,
  createTestReview,
} from '../../../__tests__/helpers/test-utils.js';
import * as ragService from '../rag.service.js';

// Mock the LLM client
vi.mock('@review-engine/ai', async (importOriginal) => {
  const original = await importOriginal<typeof import('@review-engine/ai')>();
  return {
    ...original,
    llmClient: {
      ...original.llmClient,
      chat: vi.fn(),
      embed: vi.fn(),
    },
  };
});

describe('RAG Chat System', () => {
  beforeAll(async () => {
    await createTestDb();
    await resetTestDb();

    // Persistently mock embed queries to avoid undefined returns in multiple tests
    const mockQueryEmbedding = Array.from({ length: 384 }, (_, idx) => (idx === 0 ? 0.85 : 0.01));
    vi.mocked(llmClient.embed).mockResolvedValue({
      embeddings: [mockQueryEmbedding],
      model: AI_CONFIG.EMBEDDING_MODEL,
      provider: 'local',
      usage: { totalTokens: 5 },
      cost: { totalCost: 0 },
      latencyMs: 10,
    });
  });

  afterAll(async () => {
    await resetTestDb();
    vi.restoreAllMocks();
  });

  it('should successfully handle RAG chat flow, store conversation, fetch history and aggregate stats', async () => {
    const user = await createTestUser({ email: 'rag-test-admin@test.com' });
    const project = await createTestProject(user.id);

    // Create 1 completed review and generate embedding
    const r1 = await createTestReview(project.id, {
      reviewText: 'The checkout checkout page keeps crashing on checkout.',
      rating: 1,
      processingStatus: 'completed',
    });

    const mockEmbedding = Array.from({ length: 384 }, (_, idx) => (idx === 0 ? 0.95 : 0.01));

    vi.mocked(llmClient.chat).mockResolvedValueOnce({
      content: 'The common complaint is that the checkout page crashes.',
      model: 'deepseek-chat',
      provider: 'deepseek',
      usage: { inputTokens: 120, outputTokens: 60, totalTokens: 180 },
      cost: { inputCost: 0.0001, outputCost: 0.0002, totalCost: 0.0003 },
      latencyMs: 150,
      retries: 0,
    });

    // Seed direct embedding in DB for r1 so semanticSearch succeeds
    const vectorStr = `[${mockEmbedding.join(',')}]`;
    await db.execute(
      `INSERT INTO review_embeddings (review_id, project_id, embedding_model, dimensions, embedding)
       VALUES ('${r1.id}', '${project.id}', '${AI_CONFIG.EMBEDDING_MODEL}', 384, '${vectorStr}'::vector)`
    );

    // 2. Execute RAG chat
    const chatResult = await ragService.chat(project.id, user.id, 'Why is checkout crashing?');

    expect(chatResult.answer).toBe('The common complaint is that the checkout page crashes.');
    expect(chatResult.sources).toHaveLength(1);
    expect(chatResult.sources[0]?.id).toBe(r1.id);
    expect(chatResult.cost.totalCost).toBe(0.0003);

    // Verify DB chat messages logged
    const dbMessages = await db.select().from(chatMessages);
    expect(dbMessages).toHaveLength(2);

    const userMsg = dbMessages.find((m) => m.role === 'user');
    const assistantMsg = dbMessages.find((m) => m.role === 'assistant');

    expect(userMsg?.content).toBe('Why is checkout crashing?');
    expect(assistantMsg?.content).toBe('The common complaint is that the checkout page crashes.');
    expect(assistantMsg?.metadata).toBeDefined();

    // 3. Fetch History
    const history = await ragService.getChatHistory(project.id, user.id);
    expect(history).toHaveLength(2);
    expect(history.map((m) => m.role)).toContain('user');
    expect(history.map((m) => m.role)).toContain('assistant');

    // 4. Fetch Stats
    const stats = await ragService.getProjectChatStats(project.id);
    expect(stats.totalMessages).toBe(2);
    expect(stats.totalCost).toBe(0.0003);
    expect(stats.averageLatencyMs).toBe(150);
  });

  it('should return default message if no reviews are embedded yet', async () => {
    // Clean database before starting
    await resetTestDb();

    const user = await createTestUser({ email: 'rag-empty-admin@test.com' });
    const project = await createTestProject(user.id);

    const chatResult = await ragService.chat(project.id, user.id, 'Is there any issue?');
    expect(chatResult.answer).toBe(
      'No reviews found in this project yet. Please ingest and process reviews first.'
    );
    expect(chatResult.sources).toHaveLength(0);
  });
});
