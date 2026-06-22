export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string; // Override default model
  provider?: 'deepseek'; // Single provider
  responseFormat?: 'json' | 'text';
}

export interface LLMResponse {
  content: string;
  model: string;
  provider: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  cost: {
    inputCost: number; // in USD
    outputCost: number; // in USD
    totalCost: number; // in USD
  };
  latencyMs: number;
  retries: number;
}

export interface EmbeddingResponse {
  embeddings: number[][];
  model: string;
  provider: string;
  usage: { totalTokens: number };
  cost: { totalCost: number };
  latencyMs: number;
}
