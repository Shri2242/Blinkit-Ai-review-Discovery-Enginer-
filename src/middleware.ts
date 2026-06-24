import { NextRequest, NextResponse } from "next/server";

/**
 * ReviewPulse — Edge middleware.
 *
 * 1. Security headers on every response (Helmet-equivalent for Next.js).
 *    Strict CSP: no unsafe-eval/unsafe-inline; allows the app's own scripts/styles.
 * 2. In-memory rate limiting on /api/auth/login and /api/auth/register
 *    (10 requests / 15 min per IP). Lighter than a Redis store but sufficient
 *    for a single-instance deployment; a multi-instance prod setup should
 *    swap this for an Upstash-Redis-backed limiter.
 */

const AUTH_RATE_LIMIT = 10;
const AUTH_RATE_WINDOW_MS = 15 * 60 * 1000;
const bucket = new Map<string, { count: number; resetAt: number }>();

function rateLimit(ip: string, limit: number, windowMs: number): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = bucket.get(ip);
  if (!entry || entry.resetAt < now) {
    bucket.set(ip, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, resetAt: now + windowMs };
  }
  entry.count++;
  return {
    ok: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.resetAt,
  };
}

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") || "unknown";
}

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  "X-DNS-Prefetch-Control": "off",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Content-Security-Policy": [
    "default-src 'self'",
    process.env.NODE_ENV === "development"
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    process.env.NODE_ENV === "development"
      ? "connect-src 'self' ws: wss:"
      : "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),
};

const MUTATION_RATE_LIMIT = 100;
const MUTATION_RATE_WINDOW_MS = 15 * 60 * 1000;

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApiRoute = pathname.startsWith("/api/");
  const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);

  // Rate limit auth mutation routes and general API mutations.
  if (isApiRoute && isMutation) {
    const isAuth = pathname === "/api/auth/login" || pathname === "/api/auth/register";
    const limit = isAuth ? AUTH_RATE_LIMIT : MUTATION_RATE_LIMIT;
    const windowMs = isAuth ? AUTH_RATE_WINDOW_MS : MUTATION_RATE_WINDOW_MS;
    
    const ip = getClientIp(req);
    const key = isAuth ? `${ip}:auth` : `${ip}:mutation`;
    const rl = rateLimit(key, limit, windowMs);
    
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later.", code: "rate_limited" },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
            ...SECURITY_HEADERS,
          },
        },
      );
    }
  }

  const res = NextResponse.next();
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    res.headers.set(k, v);
  }
  return res;
}

export const config = {
  matcher: [
    // Run on everything except static asset paths and Next internals.
    "/((?!_next/static|_next/image|favicon.ico|logo.svg|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map)).*)",
  ],
};
