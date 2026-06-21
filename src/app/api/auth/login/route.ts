import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, setSessionCookie } from "@/lib/auth";
import { loginSchema } from "@/lib/validation";
import { errorResponse, logActivity } from "@/lib/rbac";

export const dynamic = "force-dynamic";

// POST /api/auth/login — verify credentials and issue a session.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error);
    }
    const { email, password } = parsed.data;

    const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
    // Generic error to prevent user enumeration.
    if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      return Response.json(
        { error: "Invalid email or password.", code: "invalid_credentials" },
        { status: 401 },
      );
    }

    await setSessionCookie({ sub: user.id, email: user.email, name: user.name });
    await logActivity(user.id, "auth.login");

    return Response.json({
      ok: true,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
