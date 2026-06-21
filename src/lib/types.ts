/** ReviewPulse — shared client types. */

export type Sentiment = "positive" | "negative" | "neutral" | "mixed";
export type Priority = "critical" | "high" | "medium" | "low";
export type SourceType = "google_play" | "app_store" | "reddit" | "twitter" | "csv_upload";

export interface Review {
  id: string;
  projectId: string;
  text: string;
  title: string | null;
  rating: number;
  reviewDate: string;
  source: SourceType;
  author: string;
  processed: boolean;
  sentiment: Sentiment | null;
  sentimentScore: number | null;
  theme: string | null;
  subTheme: string | null;
  priority: Priority | null;
  priorityReason: string | null;
  summary: string | null;
  keyPhrases: string[];
  isBug: boolean;
  isFeatureRequest: boolean;
  isActionable: boolean;
  analyzedAt: string | null;
  createdAt: string;
}

export interface Stats {
  project: { id: string; name: string; description: string | null };
  totals: { total: number; processed: number; bugs: number; features: number; sources: number };
  bySentiment: { sentiment: Sentiment; count: number }[];
  bySource: { source: string; count: number }[];
  byTheme: { theme: string; count: number }[];
  byPriority: { priority: Priority; count: number }[];
  byRating: { rating: number; count: number }[];
  sentimentTrend: {
    date: string;
    positive: number;
    negative: number;
    neutral: number;
    mixed: number;
    total: number;
  }[];
  topIssues: { theme: string; count: number }[];
}

export interface Segments {
  byRating: {
    label: string;
    count: number;
    positive: number;
    negative: number;
    neutral: number;
    mixed: number;
    bugs: number;
    features: number;
  }[];
  bySource: {
    source: string;
    count: number;
    positive: number;
    negative: number;
    neutral: number;
    mixed: number;
    avgRating: number;
  }[];
  bySentiment: {
    sentiment: string;
    count: number;
    bugs: number;
    features: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  }[];
  byTheme: {
    theme: string;
    count: number;
    positive: number;
    negative: number;
    neutral: number;
    mixed: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  }[];
  themeByRating: { theme: string; "1-2": number; "3": number; "4-5": number }[];
  themeBySource: Record<string, unknown> & { theme: string }[];
  total: number;
}

export interface Insights {
  topIssues: {
    theme: string;
    count: number;
    negativePct: number;
    severity: number;
    critical: number;
    high: number;
    samples: { id: string; text: string; rating: number; source: string }[];
  }[];
  emergingTrends: { theme: string; thisWeek: number; lastWeek: number; growthPct: number; count: number }[];
  featureRequests: { theme: string; count: number; samples: { text: string; rating: number; source: string }[] }[];
  weeklySummary: {
    weekRange: string;
    totalReviews: number;
    totalThisWeek: number;
    totalLastWeek: number;
    topTheme: string;
    negativeShare: number;
    bugCount: number;
  };
  totalAnalyzed: number;
}

export interface CollectorSource {
  id: string;
  sourceType: SourceType;
  name: string;
  config: Record<string, unknown>;
  enabled: boolean;
  schedule: string;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  lastRunCount: number;
  totalCollected: number;
  errorMessage: string | null;
  createdAt: string;
  recentLogs: {
    id: string;
    status: string;
    reviewsFetched: number;
    reviewsNew: number;
    reviewsDuplicate: number;
    durationMs: number;
    startedAt: string;
    completedAt: string | null;
  }[];
}

export interface ChatSource {
  reviewId: string;
  text: string;
  author: string;
  source: string;
  rating: number;
  score: number;
}

export interface ChatResult {
  answer: string;
  sources: ChatSource[];
  reviewCount: number;
}
