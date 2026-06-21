import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireProjectAccess, errorResponse, logActivity } from "@/lib/rbac";

export const dynamic = "force-dynamic";

// DELETE /api/reviews/clear?projectId=... — delete ALL reviews (and their
// embeddings) for the active project. Admin only. Collector sources remain.
export async function DELETE(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get("projectId") || undefined;
    const ctx = await requireProjectAccess(projectId, "admin");
    // Delete embeddings first (FK), then reviews.
    await db.reviewEmbedding.deleteMany({ where: { projectId: ctx.project!.id } });
    const result = await db.review.deleteMany({ where: { projectId: ctx.project!.id } });
    await logActivity(ctx.user.id, "reviews.clear", ctx.project!.id, { deleted: result.count });
    return NextResponse.json({ ok: true, deleted: result.count });
  } catch (err) {
    return errorResponse(err);
  }
}
