import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

import { llmClient } from '@review-engine/ai';

import {
  createTestDb,
  resetTestDb,
  createTestUser,
  createTestProject,
  createTestReview,
} from '../../../__tests__/helpers/test-utils.js';
import * as insightsService from '../insights.service.js';

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

describe('Insights and Analytics API', () => {
  beforeAll(async () => {
    await createTestDb();
    await resetTestDb();
  });

  afterAll(async () => {
    await resetTestDb();
    vi.restoreAllMocks();
  });

  it('should compute correct dashboard overview, trends, top issues, and weekly summary', async () => {
    const user = await createTestUser({ email: 'insights-admin@test.com' });
    const project = await createTestProject(user.id);

    // Seed test reviews
    // Review 1: positive usability review
    await createTestReview(project.id, {
      reviewText: 'This UI is super clean, I love it.',
      rating: 5,
      sentiment: 'positive',
      sentimentConfidence: 0.95,
      theme: 'usability',
      priority: 'low',
      source: 'app_store',
      processingStatus: 'completed',
      reviewDate: new Date(),
    });

    // Review 2: negative payment review
    await createTestReview(project.id, {
      reviewText: 'Payment keeps failing during checkout flow.',
      rating: 1,
      sentiment: 'negative',
      sentimentConfidence: 0.98,
      theme: 'payment',
      priority: 'critical',
      source: 'google_play',
      processingStatus: 'completed',
      reviewDate: new Date(),
    });

    // Review 3: pending review (should not be counted in processed analytics)
    await createTestReview(project.id, {
      reviewText: 'Unprocessed text.',
      rating: 3,
      processingStatus: 'pending',
      reviewDate: new Date(),
    });

    // 1. Check dashboard overview
    const overview = await insightsService.getDashboardOverview(project.id);
    expect(overview.totalReviews).toBe(3);
    expect(overview.processedReviews).toBe(2);
    expect(overview.unprocessedReviews).toBe(1);
    expect(overview.sentiment.positive).toBe(1);
    expect(overview.sentiment.negative).toBe(1);
    expect(overview.priority.critical).toBe(1);
    expect(overview.priority.low).toBe(1);
    expect(overview.topThemes).toHaveLength(2);
    expect(overview.topThemes.map((t) => t.name)).toContain('usability');
    expect(overview.topThemes.map((t) => t.name)).toContain('payment');

    // 2. Check sentiment trend
    const sentimentTrend = await insightsService.getSentimentTrend(project.id, 7);
    expect(sentimentTrend.length).toBeGreaterThan(0);
    expect(sentimentTrend[0]?.positive).toBe(1);
    expect(sentimentTrend[0]?.negative).toBe(1);

    // 3. Check theme trend
    const themeTrend = await insightsService.getThemeTrend(project.id, 7);
    expect(themeTrend.length).toBeGreaterThan(0);
    expect(themeTrend.map((t) => t.theme)).toContain('usability');
    expect(themeTrend.map((t) => t.theme)).toContain('payment');

    // 4. Check top issues (negative reviews)
    const topIssues = await insightsService.getTopIssues(project.id, 5);
    expect(topIssues).toHaveLength(1);
    expect(topIssues[0]?.theme).toBe('payment');
    expect(topIssues[0]?.count).toBe(1);
    expect(topIssues[0]?.averageSentimentScore).toBeCloseTo(0.98);
    expect(topIssues[0]?.priorityDistribution.critical).toBe(1);
    expect(topIssues[0]?.sampleReviews).toHaveLength(1);

    // 5. Check volume by source
    const sources = await insightsService.getReviewVolumeBySource(project.id);
    expect(sources).toHaveLength(2);
    expect(sources.map((s) => s.source)).toContain('app_store');
    expect(sources.map((s) => s.source)).toContain('google_play');

    // 6. Check weekly summary
    // Mock the summary LLM response
    const mockSummaryOutput = {
      theme: 'payment',
      period: '7 days',
      total_reviews: 1,
      sentiment_distribution: { positive: 0, negative: 1, neutral: 0, mixed: 0 },
      executive_summary: 'Payment issues are dominating checkout reports.',
      top_issues: [
        {
          issue: 'Payment timeouts.',
          frequency: '1 review',
          example_quotes: ['Payment keeps failing'],
          recommended_action: 'Investigate payment logs.',
        },
      ],
      trend: 'worsening',
      trend_evidence: 'High failure rates.',
    };

    vi.mocked(llmClient.chat).mockResolvedValue({
      content: JSON.stringify(mockSummaryOutput),
      model: 'deepseek-chat',
      provider: 'deepseek',
      usage: { inputTokens: 500, outputTokens: 200, totalTokens: 700 },
      cost: { inputCost: 0.0001, outputCost: 0.0002, totalCost: 0.0003 },
      latencyMs: 120,
      retries: 0,
    });

    const weeklySummary = await insightsService.generateWeeklySummary(project.id);
    expect(weeklySummary.themeSummaries).toHaveLength(2);
    const paymentSummary = weeklySummary.themeSummaries.find((s) => s.theme === 'payment');
    expect(paymentSummary).toBeDefined();
    expect(paymentSummary?.summary).toBe('Payment issues are dominating checkout reports.');
    expect(paymentSummary?.topIssues).toContain('Payment timeouts.');
    expect(paymentSummary?.trend).toBe('worsening');
  });
});
