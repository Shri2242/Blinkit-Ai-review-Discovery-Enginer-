import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureProject } from "@/lib/server";

export const dynamic = "force-dynamic";

// GET /api/segments — multi-dimensional segmentation of reviews.
// Returns: byRating, bySource, bySentiment, byTheme, themeByRating, themeBySource.
export async function GET() {
  const project = await ensureProject();

  const all = await db.review.findMany({
    where: { projectId: project.id, processed: true },
    select: {
      rating: true,
      source: true,
      sentiment: true,
      theme: true,
      priority: true,
      isBug: true,
      isFeatureRequest: true,
      isActionable: true,
    },
  });

  // 1. By rating bracket: Low (1-2), Mid (3), High (4-5)
  const ratingBuckets = {
    "1-2": { label: "Low (1-2★)", count: 0, positive: 0, negative: 0, neutral: 0, mixed: 0, bugs: 0, features: 0 },
    "3": { label: "Mid (3★)", count: 0, positive: 0, negative: 0, neutral: 0, mixed: 0, bugs: 0, features: 0 },
    "4-5": { label: "High (4-5★)", count: 0, positive: 0, negative: 0, neutral: 0, mixed: 0, bugs: 0, features: 0 },
  };
  const bucketKey = (r: number) => (r <= 2 ? "1-2" : r === 3 ? "3" : "4-5");

  // 2. By source platform
  const sourceMap = new Map<string, { source: string; count: number; positive: number; negative: number; neutral: number; mixed: number; avgRating: number; ratingSum: number }>();

  // 3. By sentiment
  const sentimentMap = new Map<string, { sentiment: string; count: number; bugs: 0; features: 0; critical: 0; high: 0; medium: 0; low: 0 }>();

  // 4. By theme
  const themeMap = new Map<string, { theme: string; count: number; positive: number; negative: number; neutral: number; mixed: number; critical: 0; high: 0; medium: 0; low: 0 }>();

  // 5 & 6. Cross-segments
  const themeByRatingMap = new Map<string, Record<string, number>>();
  const themeBySourceMap = new Map<string, Record<string, number>>();

  const ensureCrossTheme = (map: Map<string, Record<string, number>>, theme: string, colKey: string) => {
    if (!theme) return;
    if (!map.has(theme)) map.set(theme, {});
    const row = map.get(theme)!;
    row[colKey] = (row[colKey] || 0) + 1;
  };

  for (const r of all) {
    const bk = bucketKey(r.rating);
    const rb = ratingBuckets[bk];
    rb.count++;
    if (r.sentiment) (rb as Record<string, number>)[r.sentiment as string]++;
    if (r.isBug) rb.bugs++;
    if (r.isFeatureRequest) rb.features++;

    // source
    const s = sourceMap.get(r.source) || { source: r.source, count: 0, positive: 0, negative: 0, neutral: 0, mixed: 0, avgRating: 0, ratingSum: 0 };
    s.count++;
    s.ratingSum += r.rating;
    if (r.sentiment) (s as Record<string, number>)[r.sentiment as string]++;
    sourceMap.set(r.source, s);

    // sentiment
    const sentimentKey = r.sentiment || "unknown";
    const sm = sentimentMap.get(sentimentKey) || { sentiment: sentimentKey, count: 0, bugs: 0, features: 0, critical: 0, high: 0, medium: 0, low: 0 };
    sm.count++;
    if (r.isBug) sm.bugs++;
    if (r.isFeatureRequest) sm.features++;
    if (r.priority) (sm as Record<string, number>)[r.priority as string]++;
    sentimentMap.set(sentimentKey, sm);

    // theme
    const themeKey = r.theme || "unknown";
    const tm = themeMap.get(themeKey) || { theme: themeKey, count: 0, positive: 0, negative: 0, neutral: 0, mixed: 0, critical: 0, high: 0, medium: 0, low: 0 };
    tm.count++;
    if (r.sentiment) (tm as Record<string, number>)[r.sentiment as string]++;
    if (r.priority) (tm as Record<string, number>)[r.priority as string]++;
    themeMap.set(themeKey, tm);

    // cross
    ensureCrossTheme(themeByRatingMap, themeKey, bk);
    ensureCrossTheme(themeBySourceMap, themeKey, r.source);
  }

  // Finalize source avgRating
  const bySource = Array.from(sourceMap.values())
    .map((s) => ({
      source: s.source,
      count: s.count,
      positive: s.positive,
      negative: s.negative,
      neutral: s.neutral,
      mixed: s.mixed,
      avgRating: s.count ? Math.round((s.ratingSum / s.count) * 10) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({
    byRating: Object.values(ratingBuckets),
    bySource: bySource.sort((a, b) => b.count - a.count),
    bySentiment: Array.from(sentimentMap.values()).sort((a, b) => b.count - a.count),
    byTheme: Array.from(themeMap.values()).sort((a, b) => b.count - a.count),
    themeByRating: Array.from(themeByRatingMap.entries())
      .map(([theme, row]) => ({ theme, ...row }))
      .sort((a, b) => (b["1-2"] + b["3"] + b["4-5"]) - (a["1-2"] + a["3"] + a["4-5"]))
      .slice(0, 10),
    themeBySource: Array.from(themeBySourceMap.entries())
      .map(([theme, row]) => ({ theme, ...row }))
      .sort((a, b) => Object.values(b).reduce((x, y) => x + (y as number), 0) - Object.values(a).reduce((x, y) => x + (y as number), 0))
      .slice(0, 10),
    total: all.length,
  });
}
