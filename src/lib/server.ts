import "server-only";
import { db } from "@/lib/db";
import { getAuthContext } from "@/lib/rbac";

/**
 * Resolve the active project for an authenticated user.
 * - If a `projectId` query param is given, use it (must be a member).
 * - Otherwise default to the user's first project.
 *
 * For backwards compatibility with unauthenticated demo access (when no user
 * is logged in), falls back to the first project in the DB. This keeps the
 * landing/demo experience smooth while protected mutation routes enforce auth.
 */
export async function resolveProject(projectId?: string) {
  const ctx = await getAuthContext(projectId);
  if (ctx.project) return ctx.project;
  // Demo fallback: first project.
  return db.project.findFirst({ orderBy: { createdAt: "asc" } }) as Promise<{
    id: string;
    name: string;
    description: string | null;
  } | null>;
}

/** @deprecated use resolveProject instead. Kept for the existing routes. */
export async function ensureProject(projectId?: string) {
  const p = await resolveProject(projectId);
  if (!p) {
    // Should not happen post-seed. Return a typed null-safe shell that callers
    // handle, but to keep existing call-sites simple we throw a clear error.
    throw new Error("No project found. Run POST /api/seed first.");
  }
  return p;
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
  processed: boolean;
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
  analyzedAt: Date | null;
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
    processed: r.processed,
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
    analyzedAt: r.analyzedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}
