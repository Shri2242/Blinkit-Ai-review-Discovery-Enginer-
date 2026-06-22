import OpenAI from 'openai';

import { AI_CONFIG } from '../../config.js';
import { LLMMessage, LLMOptions, LLMResponse } from '../types.js';

/**
 * Check if mock mode is explicitly enabled via env variable.
 * This is the ONLY way to enable mock mode — not based on API key value.
 */
function isMockMode(): boolean {
  return process.env['MOCK_AI'] === 'true';
}

/**
 * DeepSeek provider — uses the OpenAI-compatible API at https://api.deepseek.com.
 * The `openai` npm SDK is reused with a custom baseURL.
 */
export class DeepSeekProvider {
  private client: OpenAI;

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey || process.env['DEEPSEEK_API_KEY'] || 'dummy_key',
      baseURL: 'https://api.deepseek.com',
    });
  }

  async chat(messages: LLMMessage[], options: LLMOptions = {}): Promise<LLMResponse> {
    const model = options.model || AI_CONFIG.PRIMARY_MODEL;
    const temperature = options.temperature ?? AI_CONFIG.ANALYSIS_TEMPERATURE;
    const maxTokens = options.maxTokens || AI_CONFIG.ANALYSIS_MAX_TOKENS;

    // ── Explicit Mock Mode (only when MOCK_AI=true env var is set) ──────
    if (isMockMode()) {
      console.warn(
        '[DeepSeekProvider] ⚠️  Running in MOCK MODE (MOCK_AI=true). No real AI calls will be made.'
      );

      if (options.responseFormat !== 'json') {
        const promptContent = messages.find((m) => m.role === 'user')?.content || '';
        return {
          content: `This is a mock RAG response answering the query: "${promptContent.split('\n').pop() || ''}". The reviews indicate some payment and interface issues.`,
          model,
          provider: 'deepseek',
          usage: { inputTokens: 250, outputTokens: 150, totalTokens: 400 },
          cost: { inputCost: 0.00004, outputCost: 0.00028, totalCost: 0.00032 },
          latencyMs: 50,
          retries: 0,
        };
      }

      // Generate realistic mock review analysis array based on reviews in the prompt
      const promptContent = messages.find((m) => m.role === 'user')?.content || '';
      const isSummarization =
        promptContent.includes('summarizing') || promptContent.includes('executive_summary');

      if (isSummarization) {
        const mockSummary = {
          theme: 'payment',
          period: '7 days',
          total_reviews: 15,
          sentiment_distribution: { positive: 5, negative: 8, neutral: 2, mixed: 0 },
          executive_summary:
            'We noticed a high volume of complaints about checkout crashing and billing. Immediate focus is needed on payment gateway caching.',
          top_issues: [
            {
              issue: 'Checkout payment gateway timeouts.',
              frequency: '8 reviews',
              example_quotes: ['Checkout failed and I was double charged.'],
              recommended_action: 'Upgrade gateway timeout limits and add retry logic.',
            },
          ],
          trend: 'worsening',
          trend_evidence: 'Negative payment reviews increased by 40% compared to previous week.',
        };

        return {
          content: JSON.stringify(mockSummary),
          model,
          provider: 'deepseek',
          usage: {
            inputTokens: 600,
            outputTokens: 200,
            totalTokens: 800,
          },
          cost: {
            inputCost: 0.00012,
            outputCost: 0.00028,
            totalCost: 0.0004,
          },
          latencyMs: 120,
          retries: 0,
        };
      }

      const matches = promptContent.match(/Review \d+:/g) || [];

      const reviewCount = Math.max(1, matches.length);

      const mockResults = Array.from({ length: reviewCount }, (_, i) => {
        const sentiments = ['positive', 'negative', 'neutral', 'mixed'] as const;
        const themes = ['payment', 'performance', 'usability', 'onboarding', 'features'] as const;
        const priorities = ['low', 'medium', 'high', 'critical'] as const;

        const sentiment = sentiments[i % sentiments.length]!;
        const theme = themes[i % themes.length]!;
        const priority = priorities[i % priorities.length]!;

        return {
          review_index: i,
          sentiment,
          sentiment_confidence: 0.95,
          theme,
          sub_theme: `${theme} feedback`,
          priority,
          priority_reason: `Mock analysis priority explanation for row ${i + 1}.`,
          key_phrases: ['mocked phrase', theme, sentiment],
          summary: `This is an auto-generated mock summary for review index ${i}.`,
          actionable: sentiment === 'negative' || priority === 'critical',
          is_bug: theme === 'performance',
          is_feature_request: theme === 'features',
        };
      });

      return {
        content: JSON.stringify(mockResults),
        model,
        provider: 'deepseek',
        usage: {
          inputTokens: 150 * reviewCount,
          outputTokens: 250 * reviewCount,
          totalTokens: 400 * reviewCount,
        },
        cost: {
          inputCost: 0.00004 * reviewCount,
          outputCost: 0.00028 * reviewCount,
          totalCost: 0.00032 * reviewCount,
        },
        latencyMs: 50,
        retries: 0,
      };
    }

    // ── Validate API key before making real calls ──────────────────────
    const apiKey = this.client.apiKey;
    if (!apiKey || apiKey === 'dummy_key' || apiKey.includes('placeholder')) {
      throw new Error(
        'DEEPSEEK_API_KEY is not configured. Set a valid API key in your environment, ' +
          'or set MOCK_AI=true to use mock mode for development/testing.'
      );
    }

    const startTime = Date.now();

    const response = await this.client.chat.completions.create({
      model,
      temperature,
      max_tokens: maxTokens,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      response_format: options.responseFormat === 'json' ? { type: 'json_object' } : undefined,
    });

    const latencyMs = Date.now() - startTime;
    const choice = response.choices[0];
    const content = choice?.message.content || '';

    // Calculate cost
    const costConfig = AI_CONFIG.COST[model as keyof typeof AI_CONFIG.COST];
    const inputTokens = response.usage?.prompt_tokens || 0;
    const outputTokens = response.usage?.completion_tokens || 0;
    const inputCost = costConfig ? (inputTokens / 1_000_000) * costConfig.input : 0;
    const outputCost = costConfig ? (outputTokens / 1_000_000) * costConfig.output : 0;

    return {
      content,
      model,
      provider: 'deepseek',
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
      },
      cost: {
        inputCost,
        outputCost,
        totalCost: inputCost + outputCost,
      },
      latencyMs,
      retries: 0,
    };
  }
}
