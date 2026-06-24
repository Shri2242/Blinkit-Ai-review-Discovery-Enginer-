import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureProject, parseKeyPhrases } from "@/lib/server";
import { errorResponse } from "@/lib/rbac";

export const dynamic = "force-dynamic";

// GET /api/insights — data-driven insight generation (no LLM call; computed from review data).
export async function GET(req: NextRequest) {
  try {
  const projectId = req.nextUrl.searchParams.get("projectId") || undefined;
  const project = await ensureProject(projectId);

  const reviews = await db.review.findMany({
    where: { projectId: project.id, processingStatus: "completed" },
    select: {
      id: true,
      text: true,
      rating: true,
      source: true,
      sentiment: true,
      theme: true,
      subTheme: true,
      priority: true,
      summary: true,
      keyPhrases: true,
      isBug: true,
      isFeatureRequest: true,
      reviewDate: true,
    },
    orderBy: { reviewDate: "desc" },
  });

  // Group by theme
  const themeStats = new Map<
    string,
    { theme: string; count: number; negative: number; critical: number; high: number; samples: { id: string; text: string; rating: number; source: string }[] }
  >();

  // Weekly counts for trend detection (last 8 weeks)
  const weekBuckets: { weekStart: string; count: number; themeCount: Map<string, number> }[] = [];
  const now = Date.now();
  for (let i = 7; i >= 0; i--) {
    const start = new Date(now - (i + 1) * 7 * 86400000);
    weekBuckets.push({ weekStart: start.toISOString().slice(0, 10), count: 0, themeCount: new Map() });
  }

  const featureRequests: { theme: string; text: string; rating: number; source: string }[] = [];

  for (const r of reviews) {
    const theme = r.theme || "unknown";
    const s = themeStats.get(theme) || { theme, count: 0, negative: 0, critical: 0, high: 0, samples: [] };
    s.count++;
    if (r.sentiment === "negative") s.negative++;
    if (r.priority === "critical") s.critical++;
    if (r.priority === "high") s.high++;
    if (s.samples.length < 3) s.samples.push({ id: r.id, text: r.text, rating: r.rating ?? 3, source: r.source });
    themeStats.set(theme, s);

    if (r.isFeatureRequest) {
      featureRequests.push({ theme, text: r.text, rating: r.rating ?? 3, source: r.source });
    }

    // weekly buckets
    const daysAgo = Math.floor((now - r.reviewDate.getTime()) / 86400000);
    const weekIdx = 7 - Math.floor(daysAgo / 7);
    if (weekIdx >= 0 && weekIdx < weekBuckets.length) {
      weekBuckets[weekIdx].count++;
      weekBuckets[weekIdx].themeCount.set(theme, (weekBuckets[weekIdx].themeCount.get(theme) || 0) + 1);
    }
  }

  // Top issues = themes ranked by (count + severity weight)
  const topIssues = Array.from(themeStats.values())
    .map((t) => ({
      theme: t.theme,
      count: t.count,
      negativePct: t.count ? Math.round((t.negative / t.count) * 100) : 0,
      severity: t.count + t.critical * 3 + t.high * 1.5,
      critical: t.critical,
      high: t.high,
      samples: t.samples,
    }))
    .sort((a, b) => b.severity - a.severity)
    .slice(0, 6);

  // Emerging trends = themes whose last-week count > previous-week count (week-over-week growth)
  const emergingTrends: { theme: string; thisWeek: number; lastWeek: number; growthPct: number; count: number }[] = [];
  if (weekBuckets.length >= 2) {
    const thisWeek = weekBuckets[weekBuckets.length - 1];
    const lastWeek = weekBuckets[weekBuckets.length - 2];
    const allThemes = new Set([...thisWeek.themeCount.keys(), ...lastWeek.themeCount.keys()]);
    for (const theme of allThemes) {
      const tw = thisWeek.themeCount.get(theme) || 0;
      const lw = lastWeek.themeCount.get(theme) || 0;
      if (tw >= 2 && tw > lw) {
        emergingTrends.push({
          theme,
          thisWeek: tw,
          lastWeek: lw,
          growthPct: lw === 0 ? 100 : Math.round(((tw - lw) / lw) * 100),
          count: tw + lw,
        });
      }
    }
  }
  emergingTrends.sort((a, b) => b.growthPct - a.growthPct);

  // Feature requests grouped by theme
  const frByTheme = new Map<string, { theme: string; count: number; samples: { text: string; rating: number; source: string }[] }>();
  for (const fr of featureRequests) {
    const e = frByTheme.get(fr.theme) || { theme: fr.theme, count: 0, samples: [] };
    e.count++;
    if (e.samples.length < 2) e.samples.push({ text: fr.text, rating: fr.rating, source: fr.source });
    frByTheme.set(fr.theme, e);
  }
  const featureRequestsRanked = Array.from(frByTheme.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  // Weekly summary (data-driven)
  const weeklySummary = {
    weekRange: `${weekBuckets[0]?.weekStart} → ${weekBuckets[weekBuckets.length - 1]?.weekStart}`,
    totalReviews: reviews.length,
    totalThisWeek: weekBuckets[weekBuckets.length - 1]?.count || 0,
    totalLastWeek: weekBuckets[weekBuckets.length - 2]?.count || 0,
    topTheme: topIssues[0]?.theme ?? "—",
    negativeShare: reviews.length
      ? Math.round((reviews.filter((r) => r.sentiment === "negative").length / reviews.length) * 100)
      : 0,
    bugCount: reviews.filter((r) => r.isBug).length,
  };

  return NextResponse.json({
    topIssues,
    emergingTrends,
    featureRequests: featureRequestsRanked,
    weeklySummary,
    totalAnalyzed: reviews.length,
  });
  } catch (err) {
    return errorResponse(err);
  }
}
