import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { errorResponse } from "@/lib/rbac";
import { z } from "zod";

export const dynamic = "force-dynamic";

const forgotSchema = z.object({ email: z.string().email() });

// In-memory reset token store (prod: Redis with 1-hour TTL).
const resetStore = new Map<string, { userId: string; expiresAt: number }>();

// POST /api/auth/forgot — request a password reset (silently succeeds even if email not found).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = forgotSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error);

    const user = await db.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
    if (user) {
      const { randomBytes } = await import("crypto");
      const token = randomBytes(32).toString("hex");
      resetStore.set(token, { userId: user.id, expiresAt: Date.now() + 3600000 });
      // In production: send email with reset link. In dev: return the token.
      const emailProvider = process.env.RESEND_API_KEY;
      if (!emailProvider) {
        return NextResponse.json({ ok: true, devMode: true, devToken: token, hint: "Dev mode: use this token with POST /api/auth/reset. Set RESEND_API_KEY for real email." });
      }
      console.log(`[email] Would send password reset email to ${user.email} with token ${token}`);
    }
    // Always return ok to prevent user enumeration.
    return NextResponse.json({ ok: true, message: "If an account exists, a reset link has been sent." });
  } catch (err) { return errorResponse(err); }
}

export { resetStore };
