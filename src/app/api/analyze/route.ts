import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureProject } from "@/lib/server";
import { analyzeReviews } from "@/lib/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/analyze — process unprocessed reviews through the AI analyzer (batched).
// Body: { limit?: number } (default 20, max 50)
export async function POST(req: Request) {
  try {
    const project = await ensureProject();
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Math.max(parseInt(body?.limit ?? "20", 10) || 20, 1), 50);

    const unprocessed = await db.review.findMany({
      where: { projectId: project.id, processed: false },
      take: limit,
      orderBy: { createdAt: "asc" },
      select: { id: true, text: true, rating: true, source: true },
    });

    if (unprocessed.length === 0) {
      return NextResponse.json({ ok: true, processed: 0, message: "No unprocessed reviews." });
    }

    // Batch in groups of 8 to keep prompts reasonable.
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
            processed: true,
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
            analyzedAt: new Date(),
          },
        });
        processedCount++;
      }
    }

    return NextResponse.json({ ok: true, processed: processedCount });
  } catch (err) {
    console.error("[api/analyze] failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
