import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/rbac";

export const dynamic = "force-dynamic";

// GET /api/auth/google — start Google OAuth flow.
//
// In production this redirects to Google's consent screen using
// GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET. The sandbox cannot complete a
// real OAuth round-trip (no public redirect URI + no real credentials), so
// this endpoint returns a clear status describing what's configured.
//
// To enable real Google login:
//   1. Create OAuth credentials at https://console.cloud.google.com/apis/credentials
//   2. Set env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
//   3. Add the redirect URI shown below to the Authorized redirect URIs list.
//   4. This endpoint will redirect to Google; the callback at /api/auth/google/callback
//      exchanges the code for a user profile and issues a session.
export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  if (!clientId || !clientSecret) {
    return NextResponse.json({
      ok: false,
      configured: false,
      error: "Google OAuth is not configured.",
      setup: {
        step1: "Create OAuth 2.0 credentials at https://console.cloud.google.com/apis/credentials",
        step2: "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables",
        step3: `Add this redirect URI to the authorized list: ${redirectUri}`,
      },
    }, { status: 503 });
  }

  // Real OAuth start: redirect to Google's consent screen.
  const scope = encodeURIComponent("openid email profile");
  const state = Math.random().toString(36).slice(2);
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&state=${state}&prompt=consent`;
  return NextResponse.redirect(authUrl);
}
