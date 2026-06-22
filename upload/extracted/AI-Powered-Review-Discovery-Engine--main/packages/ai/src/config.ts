export const AI_CONFIG = {
  // Primary LLM (DeepSeek-V3)
  PRIMARY_MODEL: 'deepseek-chat',
  PRIMARY_PROVIDER: 'deepseek',

  // Fallback LLM (DeepSeek-R1 reasoner)
  FALLBACK_MODEL: 'deepseek-reasoner',
  FALLBACK_PROVIDER: 'deepseek',

  // Embedding model (local — runs via @xenova/transformers, no API key)
  EMBEDDING_MODEL: 'Xenova/all-MiniLM-L6-v2',
  EMBEDDING_DIMENSIONS: 384,

  // Generation parameters
  ANALYSIS_TEMPERATURE: 0.1, // Low for consistency
  ANALYSIS_MAX_TOKENS: 4096,
  CHAT_TEMPERATURE: 0.3,
  CHAT_MAX_TOKENS: 2048,

  // Batching
  REVIEW_BATCH_SIZE: 15, // Reviews per LLM call
  EMBEDDING_BATCH_SIZE: 100, // Texts per embedding call

  // Cost tracking (per 1M tokens — cache-miss pricing)
  COST: {
    'deepseek-chat': { input: 0.27, output: 1.1 },
    'deepseek-reasoner': { input: 0.55, output: 2.19 },
  },
} as const;

// Keep MODEL_CONFIG for backwards compatibility if needed, mapping to new settings
export const MODEL_CONFIG = {
  analysis: {
    provider: AI_CONFIG.PRIMARY_PROVIDER,
    model: AI_CONFIG.PRIMARY_MODEL,
    maxTokens: AI_CONFIG.ANALYSIS_MAX_TOKENS,
    temperature: AI_CONFIG.ANALYSIS_TEMPERATURE,
  },
  summary: {
    provider: AI_CONFIG.PRIMARY_PROVIDER,
    model: AI_CONFIG.PRIMARY_MODEL,
    maxTokens: AI_CONFIG.CHAT_MAX_TOKENS,
    temperature: AI_CONFIG.CHAT_TEMPERATURE,
  },
  chat: {
    provider: AI_CONFIG.PRIMARY_PROVIDER,
    model: AI_CONFIG.PRIMARY_MODEL,
    maxTokens: AI_CONFIG.CHAT_MAX_TOKENS,
    temperature: AI_CONFIG.CHAT_TEMPERATURE,
  },
  embedding: {
    provider: 'local' as const,
    model: AI_CONFIG.EMBEDDING_MODEL,
    dimensions: AI_CONFIG.EMBEDDING_DIMENSIONS,
    batchSize: AI_CONFIG.EMBEDDING_BATCH_SIZE,
  },
} as const;
