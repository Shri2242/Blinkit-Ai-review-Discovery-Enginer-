import { NextResponse } from "next/server";
// [DEMO MODE] Guest auth imports commented out
// import { db } from "@/lib/db";
// import { setSessionCookie } from "@/lib/auth";
// import { errorResponse, logActivity } from "@/lib/rbac";
// import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

// POST /api/auth/guest — create a guest user (viewer role) and a session.
// [DEMO MODE] Guest auth disabled (everything is public anyway).
export async function POST() {
  // [DEMO MODE] Original implementation:
  // const guestId = randomUUID().slice(0, 8); ...
  // const guest = await db.user.create({ ... });
  // await setSessionCookie({ sub: guest.id, email: guest.email, name: guest.name });

  return NextResponse.json({
    ok: false,
    error: "Guest auth not available in demo (everything is already public)",
  });
}

