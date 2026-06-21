import "server-only";
import { db } from "@/lib/db";

/** Ensure a project exists; create the default ReviewPulse project if none. */
export async function ensureProject() {
  let project = await db.project.findFirst({ orderBy: { createdAt: "asc" } });
  if (!project) {
    project = await db.project.create({
      data: {
        name: "Spotify — Music Discovery",
        description:
          "Growth team initiative: analyze user feedback to increase meaningful music discovery.",
      },
    });
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

export type ReviewRow = Awaited<ReturnType<typeof db.review.findFirst>> & object;

export function serializeReview(r: NonNullable<ReviewRow>) {
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
