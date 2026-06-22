import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { errorResponse } from "@/lib/rbac";
import { sendEmail, isResendConfigured } from "@/lib/notifications";
import { z } from "zod";

export const dynamic = "force-dynamic";

const forgotSchema = z.object({ email: z.string().email() });

// In-memory reset token store (prod: Redis with 1-hour TTL).
const resetStore = new Map<string, { userId: string; email: string; expiresAt: number }>();

// POST /api/auth/forgot — request a password reset.
// When RESEND_API_KEY is set, sends a real email. Otherwise returns the token in dev mode.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = forgotSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error);

    const email = parsed.data.email.toLowerCase();
    const user = await db.user.findUnique({ where: { email } });

    if (user) {
      const { randomBytes } = await import("crypto");
      const token = randomBytes(32).toString("hex");
      resetStore.set(token, { userId: user.id, email: user.email, expiresAt: Date.now() + 3600000 });

      const resendConfigured = isResendConfigured();
      if (resendConfigured) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const resetLink = `${appUrl}/reset-password?token=${token}`;
        const result = await sendEmail({
          to: user.email,
          subject: "Reset your ReviewPulse password",
          html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #3b82f6;">ReviewPulse</h2>
              <p>Hi ${user.name},</p>
              <p>You requested a password reset. Click the button below to set a new password:</p>
              <p style="text-align: center; margin: 32px 0;">
                <a href="${resetLink}" style="background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Reset Password</a>
              </p>
              <p style="color: #71717a; font-size: 13px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
              <p style="color: #71717a; font-size: 12px; margin-top: 24px;">Or paste this URL: ${resetLink}</p>
            </div>
          `,
          text: `Reset your password: ${resetLink}`,
        });
        if (!result.sent) {
          // Email failed — fall back to dev mode so the user isn't stuck.
          return NextResponse.json({ ok: true, devMode: true, devToken: token, hint: `Email send failed: ${result.error}. Using dev token.` });
        }
        return NextResponse.json({ ok: true, message: "If an account exists, a reset link has been sent." });
      }

      // Dev mode: return the token.
      return NextResponse.json({
        ok: true, devMode: true, devToken: token,
        hint: "Dev mode: use this token with POST /api/auth/reset. Set RESEND_API_KEY for real email.",
      });
    }

    // Always return ok to prevent user enumeration.
    return NextResponse.json({ ok: true, message: "If an account exists, a reset link has been sent." });
  } catch (err) { return errorResponse(err); }
}

export { resetStore };
