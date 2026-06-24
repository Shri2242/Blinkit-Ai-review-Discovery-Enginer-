import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/auth/google — start Google OAuth flow.
// [DEMO MODE] Google Auth disabled.
export async function GET() {
  // [DEMO MODE] Original implementation:
  // const clientId = process.env.GOOGLE_CLIENT_ID;
  // const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  // const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  // const redirectUri = `${baseUrl}/api/auth/google/callback`;
  // ... redirect to Google's consent screen.

  return NextResponse.json({
    ok: false,
    configured: false,
    error: "Google OAuth not available in demo",
  });
}

