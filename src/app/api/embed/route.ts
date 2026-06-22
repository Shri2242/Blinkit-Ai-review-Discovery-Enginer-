import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProject } from "@/lib/server";
import { embedBatch, EMBEDDING_MODEL, EMBEDDING_DIM, isNeuralEmbeddingActive } from "@/lib/embeddings";
import { errorResponse } from "@/lib/rbac";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// POST /api/embed — generate + store 384-dim embeddings for processed reviews
// that don't yet have one. Batches 20 at a time.
export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId") || undefined;
    const project = await resolveProject(projectId);
    if (!project) {
      return NextResponse.json({ error: "No project found." }, { status: 404 });
    }
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Math.max(parseInt(body?.limit ?? "50", 10) || 50, 1), 200);

    // Find processed reviews that don't yet have an embedding row.
    const needEmbedding = await db.review.findMany({
      where: {
        projectId: project.id,
        processingStatus: "completed",
        embedding: { is: null },
      },
      select: { id: true, text: true, title: true },
      take: limit,
      orderBy: { createdAt: "asc" },
    });

    if (needEmbedding.length === 0) {
      return NextResponse.json({
        ok: true,
        embedded: 0,
        message: "All processed reviews already have embeddings.",
        neural: isNeuralEmbeddingActive(),
        model: EMBEDDING_MODEL,
      });
    }

    const BATCH = 20;
    let embedded = 0;
    for (let i = 0; i < needEmbedding.length; i += BATCH) {
      const batch = needEmbedding.slice(i, i + BATCH);
      const texts = batch.map((r) => (r.title ? `${r.title}. ${r.text}` : r.text));
      const vectors = await embedBatch(texts);
      for (let j = 0; j < batch.length; j++) {
        const r = batch[j];
        const vec = vectors[j];
        if (!vec || vec.length !== EMBEDDING_DIM) continue;
        // Upsert (delete-then-create keeps it idempotent for SQLite).
        await db.reviewEmbedding.deleteMany({ where: { reviewId: r.id } }).catch(() => null);
        await db.reviewEmbedding.create({
          data: {
            reviewId: r.id,
            projectId: project.id,
            embeddingModel: EMBEDDING_MODEL,
            dimensions: EMBEDDING_DIM,
            embedding: JSON.stringify(vec),
          },
        });
        embedded++;
      }
    }

    return NextResponse.json({
      ok: true,
      embedded,
      neural: isNeuralEmbeddingActive(),
      model: EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIM,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

// GET /api/embed — status of embeddings for the active project.
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId") || undefined;
    const project = await resolveProject(projectId);
    if (!project) {
      return NextResponse.json({ withEmbedding: 0, processed: 0, coverage: 0, neural: isNeuralEmbeddingActive(), model: EMBEDDING_MODEL, dimensions: EMBEDDING_DIM });
    }
    const [withEmbedding, processed] = await Promise.all([
      db.reviewEmbedding.count({ where: { projectId: project.id } }),
      db.review.count({ where: { projectId: project.id, processingStatus: "completed" } }),
    ]);
    return NextResponse.json({
      withEmbedding,
      processed,
      coverage: processed > 0 ? Math.round((withEmbedding / processed) * 100) : 0,
      neural: isNeuralEmbeddingActive(),
      model: EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIM,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
