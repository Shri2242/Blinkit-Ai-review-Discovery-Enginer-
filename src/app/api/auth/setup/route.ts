import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { seedDatabase } from "@/lib/seed-data";
import { setSessionCookie } from "@/lib/auth";
import { errorResponse, ApiError } from "@/lib/rbac";

export const dynamic = "force-dynamic";

// POST /api/auth/setup — first-run bootstrap.
// Creates the default admin user + demo project + 105 reviews, then issues a
// session. Only works if NO users exist yet (idempotent guard). Use this on
// first deploy, or after a full DB wipe.
export async function POST() {
  try {
    const existingUsers = await db.user.count();
    if (existingUsers > 0) {
      throw new ApiError(409, "Setup already complete. Log in or reseed from Settings instead.");
    }
    const result = await seedDatabase(db);
    if (result.user) {
      await setSessionCookie({ sub: result.user.id, email: result.user.email, name: result.user.name });
    }
    return NextResponse.json({
      ok: true,
      message: "First-run setup complete. Default admin account created and signed in.",
      project: { id: result.project.id, name: result.project.name },
      reviewsInserted: result.reviewsInserted,
      user: result.user,
      demoCredentials: { email: "pm@reviewpulse.dev", password: "ReviewPulse123!" },
    });
  } catch (err) {
    return errorResponse(err);
  }
}

// GET /api/auth/setup — check whether first-run setup is needed.
export async function GET() {
  const userCount = await db.user.count();
  return NextResponse.json({
    needsSetup: userCount === 0,
    userCount,
  });
}
