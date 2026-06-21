import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureProject } from "@/lib/server";
import { ragChat } from "@/lib/ai";
import { chatSchema } from "@/lib/validation";
import { errorResponse } from "@/lib/rbac";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/chat — RAG chat over reviews using real vector similarity.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = chatSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error);
    const question = parsed.data.question.trim();

    const projectId = req.nextUrl.searchParams.get("projectId") || undefined;
    const project = await ensureProject(projectId);
    const reviews = await db.review.findMany({
      where: { projectId: project.id, processed: true },
      select: { id: true, text: true, author: true, source: true, rating: true, title: true },
    });

    // Load any stored embeddings for real cosine-similarity retrieval.
    const embeddingRows = await db.reviewEmbedding.findMany({
      where: { projectId: project.id },
      select: { reviewId: true, embedding: true },
    });
    const embeddingByReviewId = new Map<string, number[]>();
    for (const row of embeddingRows) {
      try {
        embeddingByReviewId.set(row.reviewId, JSON.parse(row.embedding) as number[]);
      } catch {
        // skip malformed
      }
    }

    const { answer, sources } = await ragChat(
      question,
      reviews.map((r) => ({
        id: r.id,
        text: r.title ? `${r.title}. ${r.text}` : r.text,
        author: r.author,
        source: r.source,
        rating: r.rating,
      })),
      embeddingByReviewId,
    );

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
