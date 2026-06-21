import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureProject } from "@/lib/server";
import { ragChat } from "@/lib/ai";

export const dynamic = "force-dynamic";

// POST /api/chat — RAG chat over reviews.
// Body: { question: string, history?: {role, content}[] }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const question = typeof body?.question === "string" ? body.question.trim() : "";
    if (!question) {
      return NextResponse.json({ error: "question is required" }, { status: 400 });
    }

    const project = await ensureProject();
    const reviews = await db.review.findMany({
      where: { projectId: project.id, processed: true },
      select: { id: true, text: true, author: true, source: true, rating: true, title: true, reviewDate: true },
    });

    const { answer, sources } = await ragChat(
      question,
      reviews.map((r) => ({
        id: r.id,
        text: r.title ? `${r.title}. ${r.text}` : r.text,
        author: r.author,
        source: r.source,
        rating: r.rating,
      })),
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
    });
  } catch (err) {
    console.error("[api/chat] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
