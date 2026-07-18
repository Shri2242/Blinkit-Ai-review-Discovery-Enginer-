import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, requireProjectAccess, errorResponse, logActivity } from "@/lib/rbac";
import { createProjectSchema, updateProjectSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/projects — list the authenticated user's projects.
export async function GET() {
  try {
    const ctx = await getAuthContext();
    if (!ctx.user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }
    // Return the global demo project OR projects owned by the authenticated user.
    const projects = await db.project.findMany({
      where: {
        OR: [
          { name: "Blinkit Review Discovery Engine" },
          { ownerId: ctx.user.id },
          { members: { some: { userId: ctx.user.id } } },
        ],
      },
      orderBy: { createdAt: "asc" },
    });
    return Response.json({
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        role: "admin",
        createdAt: p.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

// POST /api/projects — create a new project (owner becomes admin member).
export async function POST(req: NextRequest) {
  try {
    const ctx = await getAuthContext();
    if (!ctx.user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const parsed = createProjectSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error);

    const project = await db.project.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        ownerId: ctx.user.id,
        members: { create: { userId: ctx.user.id, role: "admin" } },
      },
    });
    await logActivity(ctx.user.id, "project.create", project.id, { name: project.name });
    return Response.json({
      ok: true,
      project: { id: project.id, name: project.name, description: project.description },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
