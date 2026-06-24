import { NextRequest, NextResponse } from "next/server";
// [DEMO MODE] Resend imports commented out
// import { db } from "@/lib/db";
import { errorResponse } from "@/lib/rbac";
// import { sendEmail, isResendConfigured } from "@/lib/notifications";
import { z } from "zod";

export const dynamic = "force-dynamic";

const forgotSchema = z.object({ email: z.string().email() });

// In-memory reset token store
const resetStore = new Map<string, { userId: string; email: string; expiresAt: number }>();

// POST /api/auth/forgot — request a password reset.
// [DEMO MODE] Email disabled.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = forgotSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error);

    // [DEMO MODE] Original Resend implementation:
    // const email = parsed.data.email.toLowerCase();
    // const user = await db.user.findUnique({ where: { email } });
    // if (user) {
    //   const { randomBytes } = await import("crypto");
    //   const token = randomBytes(32).toString("hex");
    //   resetStore.set(token, { ... });
    //   if (isResendConfigured()) { await sendEmail(...) }
    // }

    return NextResponse.json({
      ok: true,
      devMode: true,
      devToken: "demo-token",
      message: "Email not available in demo",
    });
  } catch (err) { return errorResponse(err); }
}

export { resetStore };
