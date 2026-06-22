import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { errorResponse } from "@/lib/rbac";
import { isTwilioConfigured, isResendConfigured, isFirebaseConfigured } from "@/lib/notifications";
import { isDeepSeekConfigured } from "@/lib/deepseek";

export const dynamic = "force-dynamic";

// GET /api/config/env — report which production env vars are configured.
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const has = (v: string | undefined) => !!v && v.length > 0;
    return NextResponse.json({
      database: {
        configured: has(process.env.DATABASE_URL),
        provider: process.env.DATABASE_URL?.startsWith("postgresql") || process.env.DATABASE_URL?.startsWith("postgres") ? "postgresql" : process.env.DATABASE_URL?.startsWith("file:") ? "sqlite" : "unknown",
        isProduction: process.env.DATABASE_URL?.startsWith("postgresql") ?? false,
      },
      jwtSecret: { configured: has(process.env.JWT_SECRET) },
      ai: {
        deepseek: { configured: isDeepSeekConfigured(), baseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com" },
        zai: { configured: true, note: "Always available as the sandbox LLM fallback." },
      },
      embeddings: {
        model: "xenova/all-MiniLM-L6-v2",
        local: true,
        note: "Runs locally via @xenova/transformers. No API key needed.",
      },
      auth: {
        google: { configured: has(process.env.GOOGLE_CLIENT_ID) && has(process.env.GOOGLE_CLIENT_SECRET) },
        twilio: { configured: isTwilioConfigured(), note: isTwilioConfigured() ? "Real SMS enabled." : "Set TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_PHONE_NUMBER." },
        resend: { configured: isResendConfigured(), note: isResendConfigured() ? "Real email enabled." : "Set RESEND_API_KEY + RESEND_FROM_EMAIL for real email." },
        firebase: { configured: isFirebaseConfigured(), note: isFirebaseConfigured() ? "Firebase Admin SDK active." : "Set FIREBASE_PROJECT_ID + FIREBASE_SERVICE_ACCOUNT (JSON)." },
        email: { configured: true, note: "Always available (scrypt + JWT)." },
        guest: { configured: true, note: "Always available." },
      },
      redis: { configured: has(process.env.REDIS_URL) },
      appUrl: process.env.NEXT_PUBLIC_APP_URL || null,
      nodeEnv: process.env.NODE_ENV || "development",
    });
  } catch (err) {
    return errorResponse(err);
  }
}
