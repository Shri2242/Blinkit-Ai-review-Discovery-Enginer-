import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureProject } from "@/lib/server";

export const dynamic = "force-dynamic";

// GET /api/stats — dashboard overview stats.
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId") || undefined;
  const project = await ensureProject(projectId);

  const [
    total,
    processed,
    bugs,
    features,
    bySentiment,
    bySource,
    byTheme,
    byPriority,
    byRating,
    last30,
  ] = await Promise.all([
    db.review.count({ where: { projectId: project.id } }),
    db.review.count({ where: { projectId: project.id, processed: true } }),
    db.review.count({ where: { projectId: project.id, isBug: true } }),
    db.review.count({ where: { projectId: project.id, isFeatureRequest: true } }),
    db.review.groupBy({
      by: ["sentiment"],
      where: { projectId: project.id },
      _count: { _all: true },
    }),
    db.review.groupBy({
      by: ["source"],
      where: { projectId: project.id },
      _count: { _all: true },
    }),
    db.review.groupBy({
      by: ["theme"],
      where: { projectId: project.id, theme: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { id: "desc" } },
      take: 12,
    }),
    db.review.groupBy({
      by: ["priority"],
      where: { projectId: project.id, priority: { not: null } },
      _count: { _all: true },
    }),
    db.review.groupBy({
      by: ["rating"],
      where: { projectId: project.id },
      _count: { _all: true },
    }),
    db.review.findMany({
      where: {
        projectId: project.id,
        reviewDate: { gte: new Date(Date.now() - 30 * 86400000) },
      },
      select: { reviewDate: true, sentiment: true, rating: true, theme: true },
      orderBy: { reviewDate: "asc" },
    }),
  ]);

  // Build a 30-day sentiment trend (group by day).
  const trendMap = new Map<string, { date: string; positive: number; negative: number; neutral: number; mixed: number; total: number }>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    trendMap.set(key, { date: key, positive: 0, negative: 0, neutral: 0, mixed: 0, total: 0 });
  }
  for (const r of last30) {
    const key = r.reviewDate.toISOString().slice(0, 10);
    const bucket = trendMap.get(key);
    if (bucket && r.sentiment) {
      bucket[r.sentiment as "positive" | "negative" | "neutral" | "mixed"]++;
      bucket.total++;
    }
  }
  const sentimentTrend = Array.from(trendMap.values());

  const topIssues = byTheme
    .filter((t) => t.theme)
    .slice(0, 8)
    .map((t) => ({ theme: t.theme, count: t._count._all }));

  return NextResponse.json({
    project: { id: project.id, name: project.name, description: project.description },
    totals: { total, processed, bugs, features, sources: bySource.length },
    bySentiment: bySentiment.map((s) => ({ sentiment: s.sentiment, count: s._count._all })),
    bySource: bySource.map((s) => ({ source: s.source, count: s._count._all })),
    byTheme: byTheme.map((t) => ({ theme: t.theme, count: t._count._all })),
    byPriority: byPriority.map((p) => ({ priority: p.priority, count: p._count._all })),
    byRating: byRating
      .map((r) => ({ rating: r.rating, count: r._count._all }))
      .sort((a, b) => a.rating - b.rating),
    sentimentTrend,
    topIssues,
  });
}
