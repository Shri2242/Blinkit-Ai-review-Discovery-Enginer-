import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireProjectAccess, errorResponse, logActivity } from "@/lib/rbac";
import { collectReviews } from "@/lib/collectors";
import { collectSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface SourceConfig {
  [k: string]: unknown;
}

// POST /api/collect — run a collector source (by id) or all enabled sources.
// Body: { sourceId?: string }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = collectSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error);

    const projectId = req.nextUrl.searchParams.get("projectId") || undefined;
    const ctx = await requireProjectAccess(projectId, "analyst");

    const sources = await db.collectorSource.findMany({
      where: { projectId: ctx.project!.id, ...(parsed.data.sourceId ? { id: parsed.data.sourceId } : { enabled: true }) },
    });

    if (sources.length === 0) {
      return NextResponse.json({ ok: false, error: "No matching collector sources found." }, { status: 404 });
    }

    const results = [];
    for (const source of sources) {
      const startedAt = new Date();
      const start = Date.now();
      try {
        let config: SourceConfig = {};
        try {
          config = JSON.parse(source.config) as SourceConfig;
        } catch {
          config = {};
        }
        const { reviews: fetched, real } = await collectReviews(source.sourceType, source.name, config);
        let newCount = 0;
        let dupCount = 0;
        for (const r of fetched) {
          const existing = await db.review.findFirst({
            where: { projectId: ctx.project!.id, sourceReviewId: r.sourceReviewId },
          });
          if (existing) {
            dupCount++;
            continue;
          }
          await db.review.create({
            data: {
              projectId: ctx.project!.id,
              text: r.text,
              title: r.title,
              rating: r.rating,
              reviewDate: new Date(),
              source: r.source,
              author: r.author,
              sourceReviewId: r.sourceReviewId,
              contentHash: r.contentHash,
              processed: false,
            },
          });
          newCount++;
        }
        const completedAt = new Date();
        await db.collectorSource.update({
          where: { id: source.id },
          data: {
            lastRunAt: startedAt,
            lastRunStatus: "success",
            lastRunCount: fetched.length,
            totalCollected: { increment: newCount },
            errorMessage: null,
          },
        });
        await db.collectorLog.create({
          data: {
            sourceId: source.id,
            status: "success",
            reviewsFetched: fetched.length,
            reviewsNew: newCount,
            reviewsDuplicate: dupCount,
            durationMs: Date.now() - start,
            startedAt,
            completedAt,
          },
        });
        results.push({ sourceId: source.id, name: source.name, fetched: fetched.length, new: newCount, duplicate: dupCount, real });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        await db.collectorSource.update({
          where: { id: source.id },
          data: { lastRunAt: startedAt, lastRunStatus: "failed", errorMessage: message },
        });
        await db.collectorLog.create({
          data: {
            sourceId: source.id,
            status: "failed",
            reviewsFetched: 0,
            reviewsNew: 0,
            reviewsDuplicate: 0,
            durationMs: Date.now() - start,
            errorMessage: message,
            startedAt,
            completedAt: new Date(),
          },
        });
        results.push({ sourceId: source.id, name: source.name, error: message });
      }
    }

    await logActivity(ctx.user.id, "collect.run", ctx.project!.id, { count: results.length });
    return NextResponse.json({ ok: true, results });
  } catch (err) {
    return errorResponse(err);
  }
}
