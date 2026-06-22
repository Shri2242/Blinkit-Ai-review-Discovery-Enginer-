import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { errorResponse } from "@/lib/rbac";

export const dynamic = "force-dynamic";

// GET /api/auth/me — return the authenticated user + their projects.
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ user: null, projects: [] });
    }
    const user = await db.user.findUnique({
      where: { id: session.sub },
      select: { id: true, email: true, name: true, authProvider: true },
    });
    if (!user) {
      return Response.json({ user: null, projects: [] });
    }
    const memberships = await db.projectMember.findMany({
      where: { userId: user.id },
      include: { project: { select: { id: true, name: true, description: true } } },
      orderBy: { createdAt: "asc" },
    });
    return Response.json({
      user,
      projects: memberships.map((m) => ({
        id: m.project.id,
        name: m.project.name,
        description: m.project.description,
        role: m.role,
      })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
