import { db } from "@/lib/db";
// [DEMO MODE] Auth imports commented out — re-enable for production
// import { getSession } from "@/lib/auth";
import { errorResponse } from "@/lib/rbac";

export const dynamic = "force-dynamic";

// GET /api/auth/me — return the authenticated user + their projects.
// [DEMO MODE] Returns a synthetic demo user with the first project, no session required.
export async function GET() {
  try {
    // [DEMO MODE] Original session-based implementation:
    // const session = await getSession();
    // if (!session) {
    //   return Response.json({ user: null, projects: [] });
    // }
    // const user = await db.user.findUnique({
    //   where: { id: session.sub },
    //   select: { id: true, email: true, name: true, authProvider: true },
    // });
    // if (!user) {
    //   return Response.json({ user: null, projects: [] });
    // }
    // const memberships = await db.projectMember.findMany({
    //   where: { userId: user.id },
    //   include: { project: { select: { id: true, name: true, description: true } } },
    //   orderBy: { createdAt: "asc" },
    // });
    // return Response.json({
    //   user,
    //   projects: memberships.map((m) => ({
    //     id: m.project.id,
    //     name: m.project.name,
    //     description: m.project.description,
    //     role: m.role,
    //   })),
    // });

    // Demo: return synthetic demo user + all projects in DB
    const projects = await db.project.findMany({ orderBy: { createdAt: "asc" } });
    const demoUser = { id: "demo", email: "demo@reviewpulse.app", name: "Demo User", authProvider: "demo" };
    return Response.json({
      user: demoUser,
      projects: projects.map((p) => ({
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

