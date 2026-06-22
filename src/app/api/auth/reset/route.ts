import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { setSessionCookie } from "@/lib/auth";
import { errorResponse, ApiError } from "@/lib/rbac";
import { z } from "zod";
import { resetStore } from "../forgot/route";

export const dynamic = "force-dynamic";

const resetSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).regex(/[A-Z]/).regex(/[a-z]/).regex(/\d/).regex(/[^A-Za-z0-9]/),
});

// POST /api/auth/reset — reset password using a token.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = resetSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error);

    const entry = resetStore.get(parsed.data.token);
    if (!entry || entry.expiresAt < Date.now()) {
      throw new ApiError(400, "Invalid or expired reset token");
    }
    const { hashPassword } = await import("@/lib/auth");
    await db.user.update({ where: { id: entry.userId }, data: { passwordHash: hashPassword(parsed.data.newPassword) } });
    resetStore.delete(parsed.data.token);
    const user = await db.user.findUnique({ where: { id: entry.userId } });
    if (user) await setSessionCookie({ sub: user.id, email: user.email, name: user.name });
    return NextResponse.json({ ok: true, message: "Password reset successfully." });
  } catch (err) { return errorResponse(err); }
}
