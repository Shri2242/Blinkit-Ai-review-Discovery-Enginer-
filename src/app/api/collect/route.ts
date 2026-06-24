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

    const results: any[] = [];
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
              processingStatus: "pending",
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

    // Auto-trigger AI analysis on newly-collected reviews or any pending reviews in the project.
    const totalNew = results.reduce((sum, r) => sum + (r.new ?? 0), 0);
    let analysisResult: { processed: number } | null = null;
    let embeddingResult: { embedded: number } | null = null;
    try {
      const { analyzeReviews } = await import("@/lib/ai");
      const unprocessed = await db.review.findMany({
        where: { projectId: ctx.project!.id, processingStatus: "pending" },
        take: 500,
        orderBy: { createdAt: "asc" },
        select: { id: true, text: true, rating: true, source: true },
      });
      if (unprocessed.length > 0) {
          const BATCH = 8;
          let processedCount = 0;
          for (let i = 0; i < unprocessed.length; i += BATCH) {
            const batch = unprocessed.slice(i, i + BATCH);
            const aiResults = await analyzeReviews(batch.map((r) => ({ id: r.id, text: r.text, rating: r.rating ?? 3, source: r.source })));
            for (let j = 0; j < batch.length; j++) {
              const r = batch[j];
              const a = aiResults[j];
              if (!a) continue;
              await db.review.update({
                where: { id: r.id },
                data: {
                  processingStatus: "completed",
                  processedAt: new Date(),
                  sentiment: a.sentiment, sentimentScore: a.sentimentScore,
                  theme: a.theme, subTheme: a.subTheme, priority: a.priority,
                  priorityReason: a.priorityReason, summary: a.summary,
                  keyPhrases: JSON.stringify(a.keyPhrases),
                  isBug: a.isBug, isFeatureRequest: a.isFeatureRequest, isActionable: a.isActionable,
                },
              });
              processedCount++;
            }
          }
          analysisResult = { processed: processedCount };

          // Auto-generate embeddings for the freshly-analyzed reviews.
          try {
            const { embedBatch, EMBEDDING_DIM, EMBEDDING_MODEL } = await import("@/lib/embeddings");
            const needEmbedding = await db.review.findMany({
              where: { projectId: ctx.project!.id, processingStatus: "completed", embedding: { is: null } },
              select: { id: true, text: true, title: true },
              take: 500,
            });
            let embedded = 0;
            for (let i = 0; i < needEmbedding.length; i += 20) {
              const batch = needEmbedding.slice(i, i + 20);
              const texts = batch.map((r) => r.title ? `${r.title}. ${r.text}` : r.text);
              const vectors = await embedBatch(texts);
              for (let j = 0; j < batch.length; j++) {
                const vec = vectors[j];
                if (!vec || vec.length !== EMBEDDING_DIM) continue;
                await db.reviewEmbedding.deleteMany({ where: { reviewId: batch[j].id } }).catch(() => null);
                await db.reviewEmbedding.create({
                  data: { reviewId: batch[j].id, projectId: ctx.project!.id, embeddingModel: EMBEDDING_MODEL, dimensions: EMBEDDING_DIM, embedding: JSON.stringify(vec) },
                });
                embedded++;
              }
            }
            embeddingResult = { embedded };
          } catch (embedErr) {
            console.error("[collect] auto-embed failed:", embedErr);
          }
        }
      } catch (analyzeErr) {
        console.error("[collect] auto-analyze failed:", analyzeErr);
      }

    return NextResponse.json({ ok: true, results, totalNew, analysis: analysisResult, embeddings: embeddingResult });
  } catch (err) {
    return errorResponse(err);
  }
}
