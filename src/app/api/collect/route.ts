import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureProject } from "@/lib/server";
import { collectSampleReviews } from "@/lib/collectors";

export const dynamic = "force-dynamic";

// POST /api/collect — run a collector source (by id) or all enabled sources.
// Body: { sourceId?: string }
// Returns a summary of fetched/new/duplicate counts.
export async function POST(req: NextRequest) {
  try {
    const project = await ensureProject();
    const body = await req.json().catch(() => ({}));
    const sourceId = typeof body?.sourceId === "string" ? body.sourceId : null;

    const sources = await db.collectorSource.findMany({
      where: { projectId: project.id, ...(sourceId ? { id: sourceId } : { enabled: true }) },
    });

    if (sources.length === 0) {
      return NextResponse.json({ ok: false, error: "No matching collector sources found." }, { status: 404 });
    }

    const results = [];
    for (const source of sources) {
      const startedAt = new Date();
      const start = Date.now();
      try {
        const fetched = collectSampleReviews(source.sourceType, source.name);
        let newCount = 0;
        let dupCount = 0;
        for (const r of fetched) {
          const existing = await db.review.findFirst({
            where: { projectId: project.id, sourceReviewId: r.sourceReviewId },
          });
          if (existing) {
            dupCount++;
            continue;
          }
          await db.review.create({
            data: {
              projectId: project.id,
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
        results.push({ sourceId: source.id, name: source.name, fetched: fetched.length, new: newCount, duplicate: dupCount });
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

    return NextResponse.json({ ok: true, results });
  } catch (err) {
    console.error("[api/collect] failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
