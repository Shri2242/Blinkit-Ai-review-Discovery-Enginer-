import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { setSessionCookie } from "@/lib/auth";
import { errorResponse, logActivity } from "@/lib/rbac";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

// POST /api/auth/guest — create a guest user (viewer role) and a session.
// Generates a unique guest user so different devices/ips get their own databases/workspaces.
export async function POST() {
  try {
    const guestId = randomUUID().slice(0, 8);
    const email = `guest_${guestId}@reviewpulse.dev`;
    const name = `Guest ${guestId}`;

    const guest = await db.user.create({
      data: {
        email,
        name,
        authProvider: "guest",
      },
    });

    await setSessionCookie({ sub: guest.id, email: guest.email, name: guest.name });
    await logActivity(guest.id, "auth.guest");

    return NextResponse.json({
      ok: true,
      user: { id: guest.id, email: guest.email, name: guest.name },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
