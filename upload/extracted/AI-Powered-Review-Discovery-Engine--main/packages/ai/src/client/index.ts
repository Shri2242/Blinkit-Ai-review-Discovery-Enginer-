import { AI_CONFIG } from '../config.js';
import { DeepSeekProvider } from './providers/deepseek.js';
import { LocalEmbedder } from './providers/local-embedder.js';
import { EmbeddingResponse, LLMMessage, LLMOptions, LLMResponse } from './types.js';

export class LLMClient {
  private deepseek: DeepSeekProvider;
  private embedder: LocalEmbedder;

  constructor() {
    this.deepseek = new DeepSeekProvider();
    this.embedder = new LocalEmbedder();
  }

  /**
   * Send a chat completion request to DeepSeek with retry + model fallback.
   * Tries deepseek-chat first; on repeated failures, falls back to deepseek-reasoner.
   */
  async chat(messages: LLMMessage[], options: LLMOptions = {}): Promise<LLMResponse> {
    const maxRetries = 3;
    let lastError: Error | null = null;
    let retries = 0;

    // Try with the requested (or default) model first
    const models = [options.model || AI_CONFIG.PRIMARY_MODEL, AI_CONFIG.FALLBACK_MODEL];

    for (const model of models) {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const response = await this.deepseek.chat(messages, { ...options, model });
          response.retries = retries;
          return response;
        } catch (error) {
          lastError = error as Error;
          retries++;

          // Don't retry on non-transient errors
          if (this.isNonRetryableError(error)) {
            break;
          }

          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(
      `DeepSeek LLM failed after ${retries} retries. Last error: ${lastError?.message}`
    );
  }

  /**
   * Generate embeddings locally via @xenova/transformers.
   * Zero API cost — runs entirely on-device.
   */
  async embed(texts: string[]): Promise<EmbeddingResponse> {
    const startTime = Date.now();

    try {
      const result = await this.embedder.embed(texts);

      return {
        embeddings: result.embeddings,
        model: result.model,
        provider: 'local',
        usage: result.usage,
        cost: { totalCost: 0 }, // Free — local model
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      throw new Error(`Local embedding generation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Get estimated cost for a set of tokens without making a call.
   */
  estimateCost(model: string, inputTokens: number, outputTokens: number): number {
    const costConfig = AI_CONFIG.COST[model as keyof typeof AI_CONFIG.COST];
    if (!costConfig) return 0;
    return (
      (inputTokens / 1_000_000) * costConfig.input + (outputTokens / 1_000_000) * costConfig.output
    );
  }

  /**
   * Determine whether an error is non-retryable (auth, permissions, bad requests).
   */
  isNonRetryableError(error: unknown): boolean {
    const message = (error as Error).message?.toLowerCase() || '';
    // Don't retry auth errors, invalid requests, etc.
    return (
      message.includes('api key') ||
      message.includes('invalid_request') ||
      message.includes('authentication') ||
      message.includes('permission')
    );
  }
}

// Singleton instance
export const llmClient = new LLMClient();
export { DeepSeekProvider, LocalEmbedder };
