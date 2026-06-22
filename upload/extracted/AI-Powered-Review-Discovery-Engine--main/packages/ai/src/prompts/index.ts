// ─────────────────────────────────────────────────────────────────────────────
// Prompt templates entrypoint
// ─────────────────────────────────────────────────────────────────────────────

export * from './system.js';
export * from './analysis.js';
export * from './summarization.js';
export * from './rag.js';

import { RAG_SYSTEM_PROMPT } from './rag.js';
import { ANALYSIS_SYSTEM_PROMPT } from './system.js';

export const PROMPTS = {
  /** Batch analysis prompts */
  batchAnalysis: {
    system: ANALYSIS_SYSTEM_PROMPT,
  },

  /** RAG chat prompts */
  ragChat: {
    system: RAG_SYSTEM_PROMPT,
  },
} as const;
