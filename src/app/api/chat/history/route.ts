import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, errorResponse } from "@/lib/rbac";

export const dynamic = "force-dynamic";

// GET /api/chat/history?projectId=... — retrieve chat history for the current user+project.
export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get("projectId") || undefined;
    const ctx = await getAuthContext(projectId);
    if (!ctx.user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (!ctx.project) return NextResponse.json({ error: "No project access" }, { status: 403 });

    const messages = await db.chatMessage.findMany({
      where: { projectId: ctx.project.id, userId: ctx.user.id },
      orderBy: { createdAt: "asc" },
      take: 100,
    });

    return NextResponse.json({
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        metadata: m.metadata ? JSON.parse(m.metadata) : null,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

// DELETE /api/chat/history?projectId=... — clear chat history for the current user+project.
export async function DELETE(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get("projectId") || undefined;
    const ctx = await getAuthContext(projectId);
    if (!ctx.user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (!ctx.project) return NextResponse.json({ error: "No project access" }, { status: 403 });

    await db.chatMessage.deleteMany({ where: { projectId: ctx.project.id, userId: ctx.user.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
