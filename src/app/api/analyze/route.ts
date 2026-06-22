import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireProjectAccess, errorResponse, logActivity } from "@/lib/rbac";
import { analyzeSchema } from "@/lib/validation";
import { analyzeReviews } from "@/lib/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/analyze — process unprocessed reviews through the AI analyzer (analyst+).
export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId") || undefined;
    const ctx = await requireProjectAccess(projectId, "analyst");
    const body = await req.json().catch(() => ({}));
    const parsed = analyzeSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error);
    const { limit } = parsed.data;

    const unprocessed = await db.review.findMany({
      where: { projectId: ctx.project!.id, processingStatus: "pending" },
      take: limit,
      orderBy: { createdAt: "asc" },
      select: { id: true, text: true, rating: true, source: true },
    });

    if (unprocessed.length === 0) {
      return NextResponse.json({ ok: true, processed: 0, message: "No unprocessed reviews." });
    }

    const BATCH = 8;
    let processedCount = 0;
    for (let i = 0; i < unprocessed.length; i += BATCH) {
      const batch = unprocessed.slice(i, i + BATCH);
      const results = await analyzeReviews(
        batch.map((r) => ({ id: r.id, text: r.text, rating: r.rating, source: r.source })),
      );
      for (let j = 0; j < batch.length; j++) {
        const r = batch[j];
        const a = results[j];
        if (!a) continue;
        await db.review.update({
          where: { id: r.id },
          data: {
            processingStatus: "completed",
            sentiment: a.sentiment,
            sentimentScore: a.sentimentScore,
            theme: a.theme,
            subTheme: a.subTheme,
            priority: a.priority,
            priorityReason: a.priorityReason,
            summary: a.summary,
            keyPhrases: JSON.stringify(a.keyPhrases),
            isBug: a.isBug,
            isFeatureRequest: a.isFeatureRequest,
            isActionable: a.isActionable,
            processedAt: new Date(),
          },
        });
        processedCount++;
      }
    }

    await logActivity(ctx.user.id, "ai.analyze", ctx.project!.id, { processed: processedCount });
    return NextResponse.json({ ok: true, processed: processedCount });
  } catch (err) {
    return errorResponse(err);
  }
}
