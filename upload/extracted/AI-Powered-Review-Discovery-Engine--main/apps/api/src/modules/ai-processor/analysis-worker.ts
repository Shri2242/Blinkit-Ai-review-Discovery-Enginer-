import {
  buildAnalysisPrompt,
  ANALYSIS_SYSTEM_PROMPT,
  parseAnalysisJSON,
  llmClient,
  AI_CONFIG,
  AnalysisResult,
} from '@review-engine/ai';

export interface WorkerAnalysisResult extends AnalysisResult {
  reviewId: string;
  _usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  _cost?: {
    inputCost: number;
    outputCost: number;
    totalCost: number;
  };
  _latencyMs?: number;
}

/**
 * Sends a batch of reviews to DeepSeek for analysis and returns the structured results.
 */
export async function analyzeReviewBatch(
  reviews: Array<{ id: string; text: string; rating: number | null; title: string | null }>
): Promise<WorkerAnalysisResult[]> {
  if (reviews.length === 0) return [];

  // Build prompt from reviews
  const prompt = buildAnalysisPrompt(
    reviews.map((r, i) => ({
      index: i,
      text: r.text,
      rating: r.rating,
      title: r.title,
    }))
  );

  // Call DeepSeek via llmClient
  const response = await llmClient.chat(
    [
      { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    {
      temperature: AI_CONFIG.ANALYSIS_TEMPERATURE,
      maxTokens: AI_CONFIG.ANALYSIS_MAX_TOKENS,
      responseFormat: 'json',
    }
  );

  // Parse and validate results using robust parser
  const results = parseAnalysisJSON(response.content);

  // Map results back to review IDs
  return results.map((result, i) => ({
    ...result,
    reviewId: reviews[i]?.id || '',
    _usage: response.usage,
    _cost: response.cost,
    _latencyMs: response.latencyMs,
  }));
}
