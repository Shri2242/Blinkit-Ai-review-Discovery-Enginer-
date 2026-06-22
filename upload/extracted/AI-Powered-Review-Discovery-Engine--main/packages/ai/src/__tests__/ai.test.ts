import { describe, it, expect } from 'vitest';

import { AI_CONFIG } from '../config.js';
import {
  ANALYSIS_SYSTEM_PROMPT,
  buildAnalysisPrompt,
  buildSummaryPrompt,
  buildRagPrompt,
  RAG_SYSTEM_PROMPT,
} from '../prompts/index.js';
import { parseAnalysisJSON } from '../schemas/analysis-output.js';

describe('AI Configurations', () => {
  it('should export correct DeepSeek model configurations', () => {
    expect(AI_CONFIG.PRIMARY_MODEL).toBe('deepseek-chat');
    expect(AI_CONFIG.FALLBACK_MODEL).toBe('deepseek-reasoner');
    expect(AI_CONFIG.PRIMARY_PROVIDER).toBe('deepseek');
    expect(AI_CONFIG.EMBEDDING_MODEL).toBe('Xenova/all-MiniLM-L6-v2');
    expect(AI_CONFIG.EMBEDDING_DIMENSIONS).toBe(384);
  });
});

describe('AI System Prompts', () => {
  it('should have correct rules in system prompt', () => {
    expect(ANALYSIS_SYSTEM_PROMPT).toContain('Always return valid JSON');
    expect(RAG_SYSTEM_PROMPT).toContain('Cite specific reviews when making claims');
  });
});

describe('AI Prompt Builders', () => {
  it('buildAnalysisPrompt should generate valid batch prompt', () => {
    const prompt = buildAnalysisPrompt([
      { index: 1, text: 'Amazing application!', rating: 5, title: 'Loved it' },
    ]);
    expect(prompt).toContain('Review 1:');
    expect(prompt).toContain('Title: Loved it');
    expect(prompt).toContain('Rating: 5/5');
    expect(prompt).toContain('Text: "Amazing application!"');
  });

  it('buildSummaryPrompt should generate valid summary prompt', () => {
    const prompt = buildSummaryPrompt({
      theme: 'performance',
      reviews: ['App crashes frequently', 'Crashes on onboarding screen'],
      sentimentDist: { positive: 0, negative: 2, neutral: 0, mixed: 0 },
      dateRange: '2026-06-01 to 2026-06-18',
      totalReviews: 2,
    });
    expect(prompt).toContain('summarizing a cluster of 2 customer reviews');
    expect(prompt).toContain('App crashes frequently');
    expect(prompt).toContain('Negative: 2');
  });

  it('buildRagPrompt should generate valid RAG prompt', () => {
    const prompt = buildRagPrompt('Are there any crashes reported?', {
      reviews: [
        {
          id: '123',
          text: 'Crash on payment step',
          sentiment: 'negative',
          theme: 'payment',
          rating: 1,
          date: '2026-06-18',
        },
      ],
      stats: {
        totalRetrieved: 1,
        sentimentBreakdown: { negative: 1 },
        themes: { payment: 1 },
      },
    });
    expect(prompt).toContain('Total reviews retrieved: 1');
    expect(prompt).toContain('Crash on payment step');
    expect(prompt).toContain('Are there any crashes reported?');
  });
});

describe('parseAnalysisJSON', () => {
  const validItem = {
    review_index: 1,
    sentiment: 'negative',
    sentiment_confidence: 0.95,
    theme: 'performance',
    sub_theme: 'app crash',
    priority: 'critical',
    priority_reason: 'Crashes on startup, high impact',
    key_phrases: ['crash', 'startup'],
    summary: 'App crashes immediately upon opening.',
    actionable: true,
    is_bug: true,
    is_feature_request: false,
  };

  it('Strategy 1: should parse direct valid JSON array', () => {
    const raw = JSON.stringify([validItem]);
    const results = parseAnalysisJSON(raw);
    expect(results).toHaveLength(1);
    expect(results[0]!.theme).toBe('performance');
  });

  it('Strategy 2: should parse JSON wrapped inside markdown code fences', () => {
    const raw = `Here is the results:\n\`\`\`json\n[\n  ${JSON.stringify(validItem)}\n]\n\`\`\``;
    const results = parseAnalysisJSON(raw);
    expect(results).toHaveLength(1);
    expect(results[0]!.theme).toBe('performance');
  });

  it('Strategy 3: should extract array via brackets when prefixed/suffixed with text', () => {
    const raw = `Some conversational wrapper text: [\n  ${JSON.stringify(validItem)}\n] and some other garbage text here.`;
    const results = parseAnalysisJSON(raw);
    expect(results).toHaveLength(1);
    expect(results[0]!.theme).toBe('performance');
  });

  it('Strategy 4: should parse and extract reviews array from a root wrapper object', () => {
    const raw = JSON.stringify({
      reviews: [validItem],
    });
    const results = parseAnalysisJSON(raw);
    expect(results).toHaveLength(1);
    expect(results[0]!.theme).toBe('performance');
  });

  it('should throw error on invalid JSON payload structure', () => {
    const raw = '{"invalid_key": "some value"}';
    expect(() => parseAnalysisJSON(raw)).toThrow();
  });
});
