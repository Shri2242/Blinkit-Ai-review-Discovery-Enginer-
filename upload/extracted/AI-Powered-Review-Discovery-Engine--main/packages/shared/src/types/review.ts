import { z } from 'zod';

// ── Enums ───────────────────────────────────────────────────────────────────

export const ReviewSourceEnum = z.enum([
  'csv_upload',
  'app_store',
  'google_play',
  'trustpilot',
  'g2',
  'steam',
  'reddit',
  'twitter',
  'zendesk',
  'intercom',
  'manual_entry',
]);
export type ReviewSource = z.infer<typeof ReviewSourceEnum>;

export const ProcessingStatusEnum = z.enum([
  'pending',
  'processing',
  'completed',
  'failed',
  'retrying',
]);
export type ProcessingStatus = z.infer<typeof ProcessingStatusEnum>;

export const SentimentEnum = z.enum(['positive', 'negative', 'neutral', 'mixed']);
export type Sentiment = z.infer<typeof SentimentEnum>;

export const PriorityEnum = z.enum(['critical', 'high', 'medium', 'low']);
export type Priority = z.infer<typeof PriorityEnum>;

export const ThemeCategoryEnum = z.enum([
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
]);
export type ThemeCategory = z.infer<typeof ThemeCategoryEnum>;

export const UserRoleEnum = z.enum(['admin', 'analyst', 'viewer']);
export type UserRole = z.infer<typeof UserRoleEnum>;

// ── Composite Schemas and Types ─────────────────────────────────────────────

export const AnalysisResultSchema = z.object({
  sentiment: SentimentEnum,
  sentiment_confidence: z.number().min(0).max(1),
  theme: ThemeCategoryEnum,
  sub_theme: z.string(),
  priority: PriorityEnum,
  priority_reason: z.string(),
  key_phrases: z.array(z.string()),
  summary: z.string(),
  actionable: z.boolean(),
  is_bug: z.boolean(),
  is_feature_request: z.boolean(),
});
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

export const ThemeExtractSchema = z.object({
  name: z.string(),
  category: ThemeCategoryEnum,
  confidence: z.number().min(0).max(1),
  review_count: z.number().int().nonnegative(),
});
export type ThemeExtract = z.infer<typeof ThemeExtractSchema>;

export const SentimentDistributionSchema = z.object({
  positive: z.number().int().nonnegative(),
  negative: z.number().int().nonnegative(),
  neutral: z.number().int().nonnegative(),
  mixed: z.number().int().nonnegative(),
});
export type SentimentDistribution = z.infer<typeof SentimentDistributionSchema>;
