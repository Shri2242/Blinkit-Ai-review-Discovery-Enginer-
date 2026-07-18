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

    // Find the default demo project "Blinkit Review Discovery Enginer" AND any projects
    // owned by the user or where they are an active member.
    const userProjects = await db.project.findMany({
      where: {
        OR: [
          { name: "Blinkit Review Discovery Enginer" },
          { ownerId: user.id },
          { members: { some: { userId: user.id } } },
        ],
      },
      orderBy: { createdAt: "asc" },
    });

    return Response.json({
      user,
      projects: userProjects.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        role: "admin",
      })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

