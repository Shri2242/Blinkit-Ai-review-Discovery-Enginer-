import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureProject } from "@/lib/server";
// [DEMO MODE] Auth import commented out — re-enable for production
// import { getAuthContext, errorResponse } from "@/lib/rbac";
import { errorResponse } from "@/lib/rbac";
import { ragChat } from "@/lib/ai";
import { chatSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/chat — RAG chat with real vector search + chat history persistence.
// [DEMO MODE] Auth gate removed — uses first project, persists with demo user id.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = chatSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error);
    const question = parsed.data.question.trim();

    const projectId = req.nextUrl.searchParams.get("projectId") || undefined;

    // [DEMO MODE] Original auth-gated implementation:
    // const ctx = await getAuthContext(projectId);
    // if (!ctx.user) {
    //   return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    // }
    // if (!ctx.project) {
    //   return NextResponse.json({ error: "No project access" }, { status: 403 });
    // }
    // const projectRef = ctx.project;
    // const userId = ctx.user.id;

    // Demo: use first project with demo user id
    const projectRef = await ensureProject(projectId);
    const userId = "demo";

    const reviews = await db.review.findMany({
      where: { projectId: projectRef.id, processingStatus: "completed" },
      select: { id: true, text: true, author: true, source: true, rating: true, title: true, sentiment: true, theme: true, reviewDate: true },
    });

    // Load embeddings for vector search.
    const embeddingRows = await db.reviewEmbedding.findMany({
      where: { projectId: projectRef.id },
      select: { reviewId: true, embedding: true },
    });
    const embeddingByReviewId = new Map<string, number[]>();
    for (const row of embeddingRows) {
      try { embeddingByReviewId.set(row.reviewId, JSON.parse(row.embedding) as number[]); } catch { /* skip */ }
    }

    const { answer, sources } = await ragChat(
      question,
      reviews.map((r) => ({
        id: r.id,
        text: r.title ? `${r.title}. ${r.text}` : r.text,
        author: r.author,
        source: r.source,
        rating: r.rating ?? 0,
      })),
      embeddingByReviewId,
    );

    // Persist chat history (best-effort — demo user id is fine).
    try {
      await db.chatMessage.create({ data: { projectId: projectRef.id, userId, role: "user", content: question } });
      await db.chatMessage.create({
        data: {
          projectId: projectRef.id,
          userId,
          role: "assistant",
          content: answer,
          metadata: JSON.stringify({
            source_review_ids: sources.map((s) => s.reviewId),
            sources: sources.slice(0, 5).map((s) => ({ id: s.reviewId, text: s.text.slice(0, 200), similarity: s.score, sentiment: null, source: s.source })),
            vectorSearch: embeddingByReviewId.size > 0,
            embeddedCount: embeddingByReviewId.size,
          }),
        },
      });
    } catch {
      // Chat history persistence failure is non-fatal in demo mode
    }

    return NextResponse.json({
      answer,
      sources: sources.map((s) => ({
        reviewId: s.reviewId,
        text: s.text,
        author: s.author,
        source: s.source,
        rating: s.rating,
        score: Math.round(s.score * 100) / 100,
      })),
      reviewCount: reviews.length,
      embeddedCount: embeddingByReviewId.size,
      vectorSearch: embeddingByReviewId.size > 0,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
