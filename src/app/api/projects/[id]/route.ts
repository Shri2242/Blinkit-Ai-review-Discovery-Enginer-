import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireProjectAccess, errorResponse, logActivity } from "@/lib/rbac";
import { updateProjectSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// GET /api/projects/:id — fetch a single project (viewer+).
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const ctx = await requireProjectAccess(id, "viewer");
    return Response.json({
      project: {
        id: ctx.project!.id,
        name: ctx.project!.name,
        description: ctx.project!.description,
        role: ctx.membership!.role,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}

// PATCH /api/projects/:id — update project (admin only).
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const ctx = await requireProjectAccess(id, "admin");
    const body = await req.json().catch(() => ({}));
    const parsed = updateProjectSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error);
    const updated = await db.project.update({
      where: { id },
      data: {
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
        ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      },
    });
    await logActivity(ctx.user.id, "project.update", id);
    return Response.json({ ok: true, project: { id: updated.id, name: updated.name, description: updated.description } });
  } catch (err) {
    return errorResponse(err);
  }
}

// DELETE /api/projects/:id — delete project (admin only).
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const ctx = await requireProjectAccess(id, "admin");
    await db.project.delete({ where: { id } });
    await logActivity(ctx.user.id, "project.delete", id);
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
