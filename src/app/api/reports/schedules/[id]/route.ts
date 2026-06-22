import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireProjectAccess, errorResponse } from "@/lib/rbac";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// DELETE /api/reports/schedules/[id]?projectId=... — delete a report schedule (admin).
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const projectId = req.nextUrl.searchParams.get("projectId") || undefined;
    const ctx = await requireProjectAccess(projectId, "admin");
    await db.reportSchedule.deleteMany({ where: { id, projectId: ctx.project!.id } });
    return NextResponse.json({ ok: true });
  } catch (err) { return errorResponse(err); }
}
