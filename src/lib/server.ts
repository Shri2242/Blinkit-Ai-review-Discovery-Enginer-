import "server-only";
import { db } from "@/lib/db";
// [DEMO MODE] Auth imports commented out — re-enable for production
// import { getAuthContext } from "@/lib/rbac";

/**
 * DEMO MODE: Returns the first project in the DB without any auth check.
 * This makes every dashboard route public for the graduation demo.
 *
 * To restore auth:
 *   1. Re-enable the import above
 *   2. Restore the original implementation below
 */
export async function resolveProject(projectId?: string) {
  // [DEMO MODE] Original auth-gated implementation:
  // const ctx = await getAuthContext(projectId);
  // if (!ctx.user) return null;
  // return ctx.project;

  // Demo: look up project by ID if provided, otherwise default to first project
  if (projectId) {
    const proj = await db.project.findUnique({ where: { id: projectId } });
    if (proj) return proj;
  }
  return db.project.findFirst({ orderBy: { createdAt: "asc" } });
}

/**
 * DEMO MODE: Like resolveProject but throws 404 if no project exists.
 * In production this also enforces auth + membership.
 */
export async function ensureProject(projectId?: string) {
  // [DEMO MODE] Original auth-gated implementation:
  // const ctx = await getAuthContext(projectId);
  // if (!ctx.user) {
  //   const { ApiError } = await import("./rbac");
  //   throw new ApiError(401, "Authentication required");
  // }
  // if (!ctx.project) {
  //   const { ApiError } = await import("./rbac");
  //   throw new ApiError(403, "You don't have access to any project yet. Create one first.");
  // }
  // return ctx.project;

  // Demo: look up project by ID if provided, otherwise default to first project
  if (projectId) {
    const proj = await db.project.findUnique({ where: { id: projectId } });
    if (proj) return proj;
  }
  const project = await db.project.findFirst({ orderBy: { createdAt: "asc" } });
  if (!project) {
    const { ApiError } = await import("./rbac");
    throw new ApiError(404, "No project found. Run the seed route first.");
  }
  return project;
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
  rating: number | null;
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
    rating: r.rating ?? 3,
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
