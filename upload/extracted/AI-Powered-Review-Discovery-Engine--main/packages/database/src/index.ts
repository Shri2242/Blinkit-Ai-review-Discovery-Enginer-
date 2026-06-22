// ─────────────────────────────────────────────────────────────────────────────
// @review-engine/database — Drizzle ORM schema, client, and migrations
// ─────────────────────────────────────────────────────────────────────────────

export * from './schema/index.js';
export { db } from './client.js';

// Re-export commonly used drizzle-orm utilities for downstream consumers
export { eq, ne, and, or, isNull, isNotNull, sql, desc, asc, inArray } from 'drizzle-orm';
