// ─────────────────────────────────────────────────────────────────────────────
// Application-wide constants
// ─────────────────────────────────────────────────────────────────────────────

export const API_VERSION = 'v1' as const;

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
export const MAX_REVIEWS_PER_UPLOAD = 50000;

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

export const AI_BATCH_SIZE = 15;
export const EMBEDDING_BATCH_SIZE = 100;

export const JWT_EXPIRY = '15m';
export const REFRESH_TOKEN_EXPIRY = '7d';

export const RATE_LIMIT = {
  global: 100,
  auth: 10,
  upload: 5,
  chat: 30,
} as const;

export const SIMILARITY_THRESHOLD = 0.82;

export const THEME_TAXONOMY = [
  // Payment
  { id: 'billing-issue', label: 'Billing Issue', category: 'payment' },
  { id: 'checkout-fail', label: 'Checkout Failure', category: 'payment' },
  { id: 'refund-delay', label: 'Refund Delay', category: 'payment' },
  // Performance
  { id: 'app-crash', label: 'App Crash', category: 'performance' },
  { id: 'slow-loading', label: 'Slow Loading', category: 'performance' },
  { id: 'lag', label: 'Interface Lag', category: 'performance' },
  // Usability
  { id: 'navigation', label: 'Navigation Difficulty', category: 'usability' },
  { id: 'cluttered-ui', label: 'Cluttered UI', category: 'usability' },
  // Onboarding
  { id: 'signup', label: 'Sign-up Friction', category: 'onboarding' },
  { id: 'verification-fail', label: 'Verification Failure', category: 'onboarding' },
  // Features
  { id: 'dark-mode', label: 'Dark Mode Request', category: 'features' },
  { id: 'integration', label: 'Third-party Integration', category: 'features' },
  // Support
  { id: 'unhelpful-support', label: 'Unhelpful Support', category: 'support' },
  { id: 'support-delay', label: 'Long Support Response', category: 'support' },
  // Pricing
  { id: 'pricing-tier', label: 'Pricing Tiers', category: 'pricing' },
  { id: 'subscription', label: 'Subscription Pricing', category: 'pricing' },
  // Security
  { id: 'data-leak', label: 'Data Security Concern', category: 'security' },
  { id: 'mfa-issue', label: 'MFA Setup Issue', category: 'security' },
  // Reliability
  { id: 'offline-sync', label: 'Offline Sync Failure', category: 'reliability' },
  { id: 'server-downtime', label: 'Server Downtime', category: 'reliability' },
  // Content
  { id: 'translation-error', label: 'Translation Typos', category: 'content' },
  { id: 'broken-links', label: 'Broken Links', category: 'content' },
  // Other
  { id: 'general-other', label: 'Other Feedback', category: 'other' },
] as const;

// ── Deprecated/Legacy names alias for backwards compatibility ────────────────

export const PAGINATION = {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} as const;

export const RATE_LIMITS = {
  STANDARD: RATE_LIMIT.global,
  AUTH: RATE_LIMIT.auth,
} as const;

export const AI = {
  BATCH_SIZE: AI_BATCH_SIZE,
  RAG_CONTEXT_TOKEN_BUDGET: 6000,
  SEMANTIC_SEARCH_TOP_K: 50,
  MAX_RETRIES: 3,
} as const;

export const UPLOAD = {
  MAX_FILE_SIZE_BYTES,
  MAX_ROWS: MAX_REVIEWS_PER_UPLOAD,
  ALLOWED_EXTENSIONS: ['.csv', '.json'] as const,
} as const;

export const AUTH = {
  ACCESS_TOKEN_EXPIRY: JWT_EXPIRY,
  REFRESH_TOKEN_EXPIRY,
  BCRYPT_ROUNDS: 12,
} as const;

export const CACHE_TTL = {
  ANALYTICS_HOURLY: 60,
  ANALYTICS_DAILY: 3600,
} as const;

export const QUEUE_NAMES = {
  PARSE: 'parse-queue',
  ANALYZE: 'analyze-queue',
  EMBED: 'embed-queue',
  INSIGHT: 'insight-queue',
  EXPORT: 'export-queue',
  SYNC: 'sync-queue',
} as const;
