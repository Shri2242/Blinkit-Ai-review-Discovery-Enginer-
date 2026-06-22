import "server-only";
import { db } from "@/lib/db";
import { getAuthContext } from "@/lib/rbac";

/**
 * Resolve the active project for an authenticated user.
 * - If `projectId` is given, use it (must be a member).
 * - Otherwise default to the user's first project.
 *
 * RETURNS NULL if the caller is not authenticated. Data routes that use this
 * must handle null by returning 401 — NO demo fallback. This is the real
 * auth gate: nothing renders without a valid session.
 */
export async function resolveProject(projectId?: string) {
  const ctx = await getAuthContext(projectId);
  if (!ctx.user) return null; // not authenticated → no project
  return ctx.project;
}

/**
 * Like resolveProject but throws a 401 ApiError if not authenticated or not a
 * member. Use this in data routes that need a guaranteed project.
 */
export async function ensureProject(projectId?: string) {
  const ctx = await getAuthContext(projectId);
  if (!ctx.user) {
    const { ApiError } = await import("./rbac");
    throw new ApiError(401, "Authentication required");
  }
  if (!ctx.project) {
    const { ApiError } = await import("./rbac");
    throw new ApiError(403, "You don't have access to any project yet. Create one first.");
  }
  return ctx.project;
}

export function parseKeyPhrases(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export function serializeReview(r: {
  id: string;
  projectId: string;
  text: string;
  title: string | null;
  rating: number;
  reviewDate: Date;
  source: string;
  author: string;
  processingStatus: string;
  sentiment: string | null;
  sentimentScore: number | null;
  theme: string | null;
  subTheme: string | null;
  priority: string | null;
  priorityReason: string | null;
  summary: string | null;
  keyPhrases: string | null;
  isBug: boolean;
  isFeatureRequest: boolean;
  isActionable: boolean;
  processedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: r.id,
    projectId: r.projectId,
    text: r.text,
    title: r.title,
    rating: r.rating,
    reviewDate: r.reviewDate.toISOString(),
    source: r.source,
    author: r.author,
    processed: r.processingStatus === "completed",
    processingStatus: r.processingStatus,
    sentiment: r.sentiment,
    sentimentScore: r.sentimentScore,
    theme: r.theme,
    subTheme: r.subTheme,
    priority: r.priority,
    priorityReason: r.priorityReason,
    summary: r.summary,
    keyPhrases: parseKeyPhrases(r.keyPhrases),
    isBug: r.isBug,
    isFeatureRequest: r.isFeatureRequest,
    isActionable: r.isActionable,
    analyzedAt: r.processedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}
