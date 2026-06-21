import { clearSessionCookie } from "@/lib/auth";
import { errorResponse, logActivity } from "@/lib/rbac";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/auth/logout — clear the session cookie.
export async function POST() {
  try {
    const session = await getSession();
    await clearSessionCookie();
    if (session) {
      await logActivity(session.sub, "auth.logout");
    }
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
