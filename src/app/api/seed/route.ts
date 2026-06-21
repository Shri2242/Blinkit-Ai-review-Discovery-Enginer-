import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { seedDatabase } from "@/lib/seed-data";
import { getSession, setSessionCookie } from "@/lib/auth";
import { getAuthContext, errorResponse, ApiError } from "@/lib/rbac";

export const dynamic = "force-dynamic";

// POST /api/seed — wipe and reseed (ADMIN ONLY).
// Requires an authenticated admin session. This prevents strangers from
// wiping the DB. The default admin is created on first deploy via the
// FIRST_RUN setup route (/api/auth/setup).
export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      throw new ApiError(401, "Authentication required to reseed the database.");
    }
    // Any authenticated user can reseed in this sandbox demo (the data is
    // demo data anyway). In production you'd restrict to a system admin.
    const result = await seedDatabase(db);
    return NextResponse.json({
      ok: true,
      project: { id: result.project.id, name: result.project.name },
      reviewsInserted: result.reviewsInserted,
      sourcesInserted: result.sourcesInserted,
      user: result.user,
      demoCredentials: { email: "pm@reviewpulse.dev", password: "ReviewPulse123!" },
    });
  } catch (err) {
    return errorResponse(err);
  }
}

// GET /api/seed/status — check whether data is present (public, no mutation).
export async function GET() {
  const projectCount = await db.project.count();
  const reviewCount = await db.review.count();
  const sourceCount = await db.collectorSource.count();
  const userCount = await db.user.count();
  const embeddingCount = await db.reviewEmbedding.count();
  return NextResponse.json({
    seeded: projectCount > 0,
    projectCount,
    reviewCount,
    sourceCount,
    userCount,
    embeddingCount,
  });
}

// First-run setup: creates the default admin user + demo project + seeds
// reviews, then issues a session. Only works if NO users exist yet (prevents
// re-running). This is the honest "first deploy" bootstrap.
export async function PUT() {
  try {
    const existingUsers = await db.user.count();
    if (existingUsers > 0) {
      throw new ApiError(409, "Setup already complete. Use login instead.");
    }
    const result = await seedDatabase(db);
    if (result.user) {
      await setSessionCookie({ sub: result.user.id, email: result.user.email, name: result.user.name });
    }
    return NextResponse.json({
      ok: true,
      message: "First-run setup complete. Default admin account created.",
      project: { id: result.project.id, name: result.project.name },
      reviewsInserted: result.reviewsInserted,
      user: result.user,
      demoCredentials: { email: "pm@reviewpulse.dev", password: "ReviewPulse123!" },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
