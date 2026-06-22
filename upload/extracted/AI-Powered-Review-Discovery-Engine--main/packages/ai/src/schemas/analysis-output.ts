import { z } from 'zod';

export const AnalysisResultSchema = z.object({
  review_index: z.number().int().min(0),
  sentiment: z.enum(['positive', 'negative', 'neutral', 'mixed']),
  sentiment_confidence: z.number().min(0).max(1),
  theme: z.enum([
    'payment',
    'performance',
    'usability',
    'onboarding',
    'features',
    'support',
    'pricing',
    'security',
    'reliability',
    'content',
    'other',
  ]),
  sub_theme: z.string().min(1).max(255),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  priority_reason: z.string().min(1).max(500),
  key_phrases: z.array(z.string()).min(0).max(10),
  summary: z.string().min(1).max(500),
  actionable: z.boolean(),
  is_bug: z.boolean(),
  is_feature_request: z.boolean(),
});

export const AnalysisResultArraySchema = z.array(AnalysisResultSchema);

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

export function parseAnalysisJSON(rawContent: string): AnalysisResult[] {
  const cleaned = rawContent.trim();

  // Strategy 1: Direct JSON parse
  try {
    const parsed = JSON.parse(cleaned);
    return AnalysisResultArraySchema.parse(parsed);
  } catch {
    // try next strategy
  }

  // Strategy 2: Extract from markdown code blocks (```json ... ``` or ``` ... ```)
  try {
    const markdownRegex = /```(?:json)?([\s\S]*?)```/i;
    const match = cleaned.match(markdownRegex);
    if (match && match[1]) {
      const parsed = JSON.parse(match[1].trim());
      return AnalysisResultArraySchema.parse(parsed);
    }
  } catch {
    // try next strategy
  }

  // Strategy 3: Find first '[' and last ']' and parse that substring
  try {
    const startIdx = cleaned.indexOf('[');
    const endIdx = cleaned.lastIndexOf(']');
    if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
      const jsonCandidate = cleaned.substring(startIdx, endIdx + 1);
      const parsed = JSON.parse(jsonCandidate);
      return AnalysisResultArraySchema.parse(parsed);
    }
  } catch {
    // try next strategy
  }

  // Strategy 4: Find first '{' and last '}' (if the model returned an object with a reviews array or single object)
  try {
    const startIdx = cleaned.indexOf('{');
    const endIdx = cleaned.lastIndexOf('}');
    if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
      const jsonCandidate = cleaned.substring(startIdx, endIdx + 1);
      const parsed = JSON.parse(jsonCandidate) as Record<string, unknown>;
      if (Array.isArray(parsed)) {
        return AnalysisResultArraySchema.parse(parsed);
      } else if (parsed && typeof parsed === 'object') {
        const possibleArray =
          parsed['reviews'] ||
          parsed['data'] ||
          parsed['results'] ||
          Object.values(parsed).find(Array.isArray);
        if (possibleArray) {
          return AnalysisResultArraySchema.parse(possibleArray);
        }
      }
    }
  } catch {
    // try next strategy
  }

  throw new Error('Failed to parse analysis JSON from LLM output');
}
