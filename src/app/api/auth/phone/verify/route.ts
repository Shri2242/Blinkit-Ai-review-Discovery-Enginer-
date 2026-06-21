import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { setSessionCookie } from "@/lib/auth";
import { errorResponse, logActivity } from "@/lib/rbac";
import { verifyOtp } from "@/lib/otp-store";
import { z } from "zod";

export const dynamic = "force-dynamic";

const verifySchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{6,14}$/, "Valid phone number required"),
  code: z.string().regex(/^\d{6}$/, "6-digit code required"),
});

// POST /api/auth/phone/verify — verify the OTP and issue a session.
// If the phone number isn't registered, a new user is created (phone auth).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error);
    const { phone, code } = parsed.data;

    const result = verifyOtp(phone, code);
    if (!result.ok) {
      return NextResponse.json({ error: result.reason ?? "Verification failed", code: "otp_invalid" }, { status: 400 });
    }

    // Find or create a user with this phone number.
    // We store phone as firebaseUid for phone-auth users (no password).
    let user = await db.user.findFirst({ where: { firebaseUid: phone } });
    if (!user) {
      user = await db.user.create({
        data: {
          email: `phone_${phone.replace(/\+/g, "")}@reviewpulse.phone`,
          name: `Phone User`,
          passwordHash: null,
          authProvider: "phone",
          firebaseUid: phone,
        },
      });
      // Add the new phone user as a viewer of the first project, or create one.
      const project = await db.project.findFirst({ orderBy: { createdAt: "asc" } });
      if (project) {
        await db.projectMember.create({ data: { projectId: project.id, userId: user.id, role: "viewer" } });
      } else {
        await db.project.create({
          data: {
            name: "My Project",
            description: "Created via phone sign-up.",
            ownerId: user.id,
            members: { create: { userId: user.id, role: "admin" } },
          },
        });
      }
    }

    await setSessionCookie({ sub: user.id, email: user.email, name: user.name });
    await logActivity(user.id, "auth.phone");
    return NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, name: user.name, authProvider: user.authProvider },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
