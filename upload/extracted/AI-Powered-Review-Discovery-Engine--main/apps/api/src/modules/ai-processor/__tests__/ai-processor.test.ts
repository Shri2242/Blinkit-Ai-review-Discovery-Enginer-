import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

import { llmClient } from '@review-engine/ai';
import { db, reviews as reviewsTable } from '@review-engine/database';

import {
  createTestDb,
  resetTestDb,
  createTestUser,
  createTestProject,
  createTestReview,
} from '../../../__tests__/helpers/test-utils.js';
import { analyzeReviewBatch } from '../analysis-worker.js';
import * as processorService from '../processor.service.js';

// Mock the LLM client
vi.mock('@review-engine/ai', async (importOriginal) => {
  const original = await importOriginal<typeof import('@review-engine/ai')>();
  return {
    ...original,
    llmClient: {
      ...original.llmClient,
      chat: vi.fn(),
    },
  };
});

describe('AI Processor Pipeline', () => {
  beforeAll(async () => {
    await createTestDb();
    await resetTestDb();
  });

  afterAll(async () => {
    await resetTestDb();
    vi.restoreAllMocks();
  });

  describe('analysis-worker', () => {
    it('should query DeepSeek and format batch results', async () => {
      const mockResult = [
        {
          review_index: 0,
          sentiment: 'positive',
          sentiment_confidence: 0.95,
          theme: 'usability',
          sub_theme: 'UI design',
          priority: 'low',
          priority_reason: 'User likes the layout, no action required.',
          key_phrases: ['clean ui'],
          summary: 'Great UX and layout.',
          actionable: false,
          is_bug: false,
          is_feature_request: false,
        },
      ];

      vi.mocked(llmClient.chat).mockResolvedValueOnce({
        content: JSON.stringify(mockResult),
        model: 'deepseek-chat',
        provider: 'deepseek',
        usage: { inputTokens: 50, outputTokens: 100, totalTokens: 150 },
        cost: { inputCost: 0.0001, outputCost: 0.0002, totalCost: 0.0003 },
        latencyMs: 120,
        retries: 0,
      });

      const batchReviews = [
        { id: 'review-123', text: 'Love the new clean UI!', rating: 5, title: 'UX' },
      ];

      const results = await analyzeReviewBatch(batchReviews);

      expect(results).toHaveLength(1);
      expect(results[0]?.reviewId).toBe('review-123');
      expect(results[0]?.sentiment).toBe('positive');
      expect(results[0]?.theme).toBe('usability');
      expect(results[0]?._usage?.totalTokens).toBe(150);
      expect(results[0]?._cost?.totalCost).toBe(0.0003);
    });
  });

  describe('processor-service', () => {
    it('should process pending reviews and update them with DeepSeek outputs', async () => {
      const user = await createTestUser({ email: 'ai-processor-admin@test.com' });
      const project = await createTestProject(user.id);

      // Create two pending reviews
      const r1 = await createTestReview(project.id, {
        reviewText: 'Great app, checkout flow is extremely smooth!',
        rating: 5,
        processingStatus: 'pending',
      });

      const r2 = await createTestReview(project.id, {
        reviewText: 'Crash on the checkout page when clicking pay.',
        rating: 1,
        processingStatus: 'pending',
      });

      const mockAnalysisOutputs = [
        {
          review_index: 0,
          sentiment: 'positive',
          sentiment_confidence: 0.98,
          theme: 'usability',
          sub_theme: 'checkout UX',
          priority: 'low',
          priority_reason: 'User is highly satisfied with checkout.',
          key_phrases: ['checkout flow'],
          summary: 'Smooth checkout flow.',
          actionable: false,
          is_bug: false,
          is_feature_request: false,
        },
        {
          review_index: 1,
          sentiment: 'negative',
          sentiment_confidence: 0.99,
          theme: 'performance',
          sub_theme: 'app crash',
          priority: 'critical',
          priority_reason: 'Payment page crashes.',
          key_phrases: ['crash', 'pay'],
          summary: 'Crash on clicking pay.',
          actionable: true,
          is_bug: true,
          is_feature_request: false,
        },
      ];

      vi.mocked(llmClient.chat).mockResolvedValueOnce({
        content: JSON.stringify(mockAnalysisOutputs),
        model: 'deepseek-chat',
        provider: 'deepseek',
        usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
        cost: { inputCost: 0.0002, outputCost: 0.0004, totalCost: 0.0006 },
        latencyMs: 200,
        retries: 0,
      });

      const processResult = await processorService.processUnprocessedReviews(project.id, 10);

      expect(processResult.processed).toBe(2);
      expect(processResult.failed).toBe(0);
      expect(processResult.totalCost).toBe(0.0012);
      expect(processResult.totalTokens).toBe(600);

      // Verify DB updates
      const reviews = await db.select().from(reviewsTable);
      const updatedR1 = reviews.find((r) => r.id === r1.id);
      const updatedR2 = reviews.find((r) => r.id === r2.id);

      expect(updatedR1?.processingStatus).toBe('completed');
      expect(updatedR1?.sentiment).toBe('positive');
      expect(updatedR1?.theme).toBe('usability');

      expect(updatedR2?.processingStatus).toBe('completed');
      expect(updatedR2?.sentiment).toBe('negative');
      expect(updatedR2?.theme).toBe('performance');
      expect(updatedR2?.priority).toBe('critical');
      expect(updatedR2?.isBug).toBe(true);

      // Verify stats
      const stats = await processorService.getProcessingStats(project.id);
      expect(stats.totalReviews).toBe(2);
      expect(stats.processedReviews).toBe(2);
      expect(stats.bugCount).toBe(1);
      expect(stats.featureRequestCount).toBe(0);
      expect(stats.themeBreakdown['usability']).toBe(1);
      expect(stats.themeBreakdown['performance']).toBe(1);
      expect(stats.priorityBreakdown['critical']).toBe(1);
      expect(stats.priorityBreakdown['low']).toBe(1);

      // Verify filters
      const usabilityReviews = await processorService.getReviewsByTheme(project.id, 'usability');
      expect(usabilityReviews).toHaveLength(1);
      expect(usabilityReviews[0]?.id).toBe(r1.id);

      const criticalReviews = await processorService.getReviewsByPriority(project.id, 'critical');
      expect(criticalReviews).toHaveLength(1);
      expect(criticalReviews[0]?.id).toBe(r2.id);

      const negativeReviews = await processorService.getReviewsBySentiment(project.id, 'negative');
      expect(negativeReviews).toHaveLength(1);
      expect(negativeReviews[0]?.id).toBe(r2.id);
    });

    it('should return empty result when no unprocessed reviews exist', async () => {
      const user = await createTestUser({ email: 'empty-ai-admin@test.com' });
      const project = await createTestProject(user.id);

      const result = await processorService.processUnprocessedReviews(project.id, 10);
      expect(result.processed).toBe(0);
      expect(result.batches).toBe(0);
    });
  });
});
