import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { setSessionCookie } from "@/lib/auth";
import { errorResponse, ApiError } from "@/lib/rbac";
import { z } from "zod";
import { createHash, randomBytes } from "crypto";

export const dynamic = "force-dynamic";

const refreshSchema = z.object({ refreshToken: z.string().min(1) });

// In-memory refresh token store (prod: Redis with 7-day TTL + rotation).
// Map<tokenHash, { userId, expiresAt }>
const refreshStore = new Map<string, { userId: string; expiresAt: number }>();

/** Issue a refresh token (called by login/register). Returns the raw token. */
export async function issueRefreshToken(userId: string): Promise<string> {
  const raw = randomBytes(64).toString("hex");
  const hash = createHash("sha256").update(raw).digest("hex");
  refreshStore.set(hash, { userId, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 });
  return raw;
}

/** Verify a refresh token and return the userId. Deletes the old token (rotation). */
export function verifyRefreshToken(raw: string): string | null {
  const hash = createHash("sha256").update(raw).digest("hex");
  const entry = refreshStore.get(hash);
  if (!entry || entry.expiresAt < Date.now()) {
    refreshStore.delete(hash);
    return null;
  }
  refreshStore.delete(hash); // rotation
  return entry.userId;
}

// POST /api/auth/refresh — exchange a refresh token for a new session.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = refreshSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error);

    const userId = verifyRefreshToken(parsed.data.refreshToken);
    if (!userId) throw new ApiError(401, "Invalid or expired refresh token");

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) throw new ApiError(401, "User not found or inactive");

    await setSessionCookie({ sub: user.id, email: user.email, name: user.name });
    const newRefresh = await issueRefreshToken(user.id);
    return NextResponse.json({ ok: true, refreshToken: newRefresh });
  } catch (err) { return errorResponse(err); }
}
