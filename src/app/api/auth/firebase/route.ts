import { NextRequest, NextResponse } from "next/server";
// [DEMO MODE] Firebase imports commented out — re-enable for production
// import { db } from "@/lib/db";
// import { setSessionCookie } from "@/lib/auth";
// import { errorResponse, ApiError, logActivity } from "@/lib/rbac";
// import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/notifications";
import { errorResponse } from "@/lib/rbac";
import { z } from "zod";

export const dynamic = "force-dynamic";

const firebaseSchema = z.object({ idToken: z.string().min(1) });

// POST /api/auth/firebase — verify a Firebase ID token and issue a session.
// [DEMO MODE] Firebase disabled.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = firebaseSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error);

    // [DEMO MODE] Original Firebase implementation:
    // if (!isFirebaseConfigured()) { ... }
    // const auth = await getFirebaseAuth(); ...
    // const decoded = await auth.verifyIdToken(parsed.data.idToken) ...
    // let user = await db.user.findUnique({ where: { email: userEmail } }); ...

    return NextResponse.json({
      ok: false,
      configured: false,
      error: "Firebase not available in demo",
    });
  } catch (err) { return errorResponse(err); }
}

