import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireProjectAccess, errorResponse, logActivity } from "@/lib/rbac";
import { inviteMemberSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// GET /api/team?projectId=... — list members of a project (viewer+).
// (Kept as a query-param route so the existing client doesn't need project-id path plumbing.)
export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get("projectId") || undefined;
    const ctx = await requireProjectAccess(projectId, "viewer");
    const members = await db.projectMember.findMany({
      where: { projectId: ctx.project!.id },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });
    return Response.json({
      members: members.map((m) => ({
        id: m.id,
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
        addedAt: m.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

// POST /api/team?projectId=... — invite a member by email (admin only).
// In this sandbox we create the membership directly against an existing user
// (or create a stub user with auth_provider='email' + no password, who must
// later set one). A real system would send an email invite with a token.
export async function POST(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get("projectId") || undefined;
    const ctx = await requireProjectAccess(projectId, "admin");
    const body = await req.json().catch(() => ({}));
    const parsed = inviteMemberSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error);

    const { email, name, role } = parsed.data;
    // Find or create a stub user.
    let user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      user = await db.user.create({
        data: { email: email.toLowerCase(), name, authProvider: "email", passwordHash: null },
      });
    }
    // Idempotent: if already a member, update role.
    const existing = await db.projectMember.findUnique({
      where: { projectId_userId: { projectId: ctx.project!.id, userId: user.id } },
    });
    if (existing) {
      const updated = await db.projectMember.update({
        where: { id: existing.id },
        data: { role },
      });
      return Response.json({ ok: true, member: { id: updated.id, role: updated.role } });
    }
    const member = await db.projectMember.create({
      data: { projectId: ctx.project!.id, userId: user.id, role, invitedBy: ctx.user.id },
    });
    await logActivity(ctx.user.id, "team.invite", ctx.project!.id, { email, role });
    return Response.json({
      ok: true,
      member: { id: member.id, userId: user.id, name: user.name, email: user.email, role: member.role },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
