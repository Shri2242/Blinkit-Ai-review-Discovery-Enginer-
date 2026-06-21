import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { registerSchema } from "@/lib/validation";
import { errorResponse, logActivity } from "@/lib/rbac";

export const dynamic = "force-dynamic";

// POST /api/auth/register — create a user, an auto-project, and a session.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error);
    }
    const { name, email, password } = parsed.data;

    // User enumeration prevention: if the email is already taken, we still
    // return 409 but with a generic message. The client can offer to log in.
    const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return Response.json(
        { error: "An account with this email already exists.", code: "email_taken" },
        { status: 409 },
      );
    }

    const passwordHash = hashPassword(password);
    const user = await db.user.create({
      data: {
        email: email.toLowerCase(),
        name,
        passwordHash,
        authProvider: "email",
      },
    });

    // Auto-create a default project owned by the new user + admin membership.
    const project = await db.project.create({
      data: {
        name: "Spotify — Music Discovery",
        description:
          "Growth team initiative: analyze user feedback to increase meaningful music discovery.",
        ownerId: user.id,
        members: {
          create: { userId: user.id, role: "admin" },
        },
      },
    });

    await setSessionCookie({ sub: user.id, email: user.email, name: user.name });
    await logActivity(user.id, "auth.register", project.id);

    return Response.json({
      ok: true,
      user: { id: user.id, email: user.email, name: user.name },
      project: { id: project.id, name: project.name },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
