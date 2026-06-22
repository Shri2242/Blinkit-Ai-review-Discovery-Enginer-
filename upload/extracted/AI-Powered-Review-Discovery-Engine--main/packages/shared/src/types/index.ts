// ─────────────────────────────────────────────────────────────────────────────
// Core domain types for the Review Discovery Engine
// ─────────────────────────────────────────────────────────────────────────────

import {
  ReviewSource,
  ProcessingStatus,
  Sentiment,
  ThemeCategory,
  Priority,
  UserRole,
} from './review.js';

// Re-export all sub-modules
export * from './review.js';
export * from './api.js';

// Alias PriorityLevel for backwards compatibility
export type PriorityLevel = Priority;

// ── Domain Entities ─────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  avatarUrl: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  appStoreUrl: string | null;
  googlePlayUrl: string | null;
  settings: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Review {
  id: string;
  projectId: string;
  source: ReviewSource;
  sourceReviewId: string | null;
  reviewText: string;
  reviewTitle: string | null;
  rating: number | null;
  authorName: string | null;
  reviewDate: Date;
  language: string;
  contentHash: string;
  metadata: Record<string, unknown>;

  // Processing state
  processingStatus: ProcessingStatus;
  processedAt: Date | null;
  processingError: string | null;
  retryCount: number;

  // AI analysis (populated by pipeline)
  sentiment: Sentiment | null;
  sentimentConfidence: number | null;
  theme: ThemeCategory | null;
  subTheme: string | null;
  priority: PriorityLevel | null;
  priorityReason: string | null;
  keyPhrases: string[];
  aiSummary: string | null;
  isBug: boolean;
  isFeatureRequest: boolean;
  actionable: boolean;

  // Vector reference
  embeddingId: string | null;

  createdAt: Date;
  updatedAt: Date;
}

export interface Insight {
  id: string;
  projectId: string;
  insightType: string;
  theme: ThemeCategory | null;
  title: string;
  summary: string;
  details: Record<string, unknown>;
  severity: PriorityLevel | null;
  reviewCount: number;
  dateRangeStart: Date | null;
  dateRangeEnd: Date | null;
  isRead: boolean;
  isDismissed: boolean;
  createdAt: Date;
}

export interface UploadBatch {
  id: string;
  projectId: string;
  uploadedBy: string;
  filename: string;
  source: ReviewSource;
  fileUrl: string | null;
  totalRows: number;
  processedRows: number;
  failedRows: number;
  status: ProcessingStatus;
  errorLog: unknown[];
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

export interface ChatSession {
  id: string;
  projectId: string;
  userId: string;
  title: string | null;
  createdAt: Date;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  sourceReviews: unknown | null;
  tokenCount: number | null;
  createdAt: Date;
}

// ── API Support Types ───────────────────────────────────────────────────────

export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  cursor?: string;
}

// ── AI Pipeline Types ───────────────────────────────────────────────────────

export interface BatchAnalysisResult {
  reviewIndex: number;
  sentiment: Sentiment;
  sentimentConfidence: number;
  theme: ThemeCategory;
  subTheme: string;
  priority: PriorityLevel;
  priorityReason: string;
  keyPhrases: string[];
  summary: string;
  actionable: boolean;
  isBug: boolean;
  isFeatureRequest: boolean;
}

export interface InsightSummaryResult {
  title: string;
  executiveSummary: string;
  topIssues: Array<{
    issue: string;
    frequency: string;
    exampleQuotes: string[];
    recommendedAction: string;
  }>;
  trend: 'improving' | 'worsening' | 'stable';
  trendEvidence: string;
}

export interface ChatResponse {
  answer: string;
  sourceReviews: Array<{
    reviewId: string;
    snippet: string;
    relevanceScore: number;
  }>;
  confidence: number;
}
