import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireProjectAccess, errorResponse, logActivity } from "@/lib/rbac";
import { updateRoleSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ userId: string }> };

// PATCH /api/team/[userId]?projectId=... — change a member's role (admin only).
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await params;
    const projectId = req.nextUrl.searchParams.get("projectId") || undefined;
    const ctx = await requireProjectAccess(projectId, "admin");
    const body = await req.json().catch(() => ({}));
    const parsed = updateRoleSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error);

    // Prevent removing the last admin.
    if (parsed.data.role !== "admin" && userId === ctx.user.id) {
      const adminCount = await db.projectMember.count({
        where: { projectId: ctx.project!.id, role: "admin" },
      });
      if (adminCount <= 1) {
        return Response.json(
          { error: "You cannot demote the last admin of a project.", code: "last_admin" },
          { status: 400 },
        );
      }
    }

    const updated = await db.projectMember.update({
      where: { projectId_userId: { projectId: ctx.project!.id, userId } },
      data: { role: parsed.data.role },
    });
    await logActivity(ctx.user.id, "team.update_role", ctx.project!.id, { userId, role: parsed.data.role });
    return Response.json({ ok: true, member: { id: updated.id, role: updated.role } });
  } catch (err) {
    return errorResponse(err);
  }
}

// DELETE /api/team/[userId]?projectId=... — remove a member (admin only).
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await params;
    const projectId = req.nextUrl.searchParams.get("projectId") || undefined;
    const ctx = await requireProjectAccess(projectId, "admin");

    if (userId === ctx.user.id) {
      const adminCount = await db.projectMember.count({
        where: { projectId: ctx.project!.id, role: "admin" },
      });
      if (adminCount <= 1) {
        return Response.json(
          { error: "You cannot remove the last admin of a project.", code: "last_admin" },
          { status: 400 },
        );
      }
    }

    await db.projectMember.delete({
      where: { projectId_userId: { projectId: ctx.project!.id, userId } },
    });
    await logActivity(ctx.user.id, "team.remove", ctx.project!.id, { userId });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
