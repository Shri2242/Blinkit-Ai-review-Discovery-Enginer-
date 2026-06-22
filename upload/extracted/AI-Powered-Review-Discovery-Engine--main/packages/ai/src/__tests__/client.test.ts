import { describe, it, expect } from 'vitest';

import { LLMClient } from '../client/index.js';
import { DeepSeekProvider } from '../client/providers/index.js';

describe('LLMClient Smoke Tests', () => {
  it('should be instantiated successfully', () => {
    const client = new LLMClient();
    expect(client).toBeDefined();
    expect(client).toBeInstanceOf(LLMClient);
  });

  it('should calculate cost estimations for DeepSeek models', () => {
    const client = new LLMClient();

    // Test for deepseek-chat: input: 0.27/M, output: 1.10/M
    // For 1,000,000 input tokens and 1,000,000 output tokens: 0.27 + 1.10 = 1.37 USD
    const costChat = client.estimateCost('deepseek-chat', 1_000_000, 1_000_000);
    expect(costChat).toBeCloseTo(1.37, 4);

    // Test for deepseek-reasoner: input: 0.55/M, output: 2.19/M
    // For 2,000,000 input tokens and 500,000 output tokens: (2 * 0.55) + (0.5 * 2.19) = 1.10 + 1.095 = 2.195 USD
    const costReasoner = client.estimateCost('deepseek-reasoner', 2_000_000, 500_000);
    expect(costReasoner).toBeCloseTo(2.195, 4);

    // For unknown model should return 0
    const costUnknown = client.estimateCost('non-existent-model', 1_000_000, 1_000_000);
    expect(costUnknown).toBe(0);
  });

  it('should identify non-retryable errors correctly', () => {
    const client = new LLMClient();

    // Auth errors, permissions, and invalid API keys are non-retryable
    expect(client.isNonRetryableError(new Error('Invalid API key provided'))).toBe(true);
    expect(client.isNonRetryableError(new Error('Authentication failed'))).toBe(true);
    expect(client.isNonRetryableError(new Error('Permission denied for this resource'))).toBe(true);
    expect(client.isNonRetryableError(new Error('invalid_request_error: model not found'))).toBe(
      true
    );

    // Transient network issues or rate limits should be retryable (returns false for non-retryable)
    expect(client.isNonRetryableError(new Error('Rate limit exceeded'))).toBe(false);
    expect(client.isNonRetryableError(new Error('Timeout connection error'))).toBe(false);
    expect(client.isNonRetryableError(new Error('Internal server error'))).toBe(false);
  });

  it('should use DeepSeekProvider internally', () => {
    const client = new LLMClient();
    // Verify the internal provider is DeepSeekProvider via duck-typing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const internalProvider = (client as any).deepseek;
    expect(internalProvider).toBeInstanceOf(DeepSeekProvider);
  });
});
