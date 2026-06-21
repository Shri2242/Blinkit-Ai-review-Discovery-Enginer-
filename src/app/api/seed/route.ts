import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { seedDatabase } from "@/lib/seed-data";
import { getSession, setSessionCookie } from "@/lib/auth";
import { errorResponse } from "@/lib/rbac";

export const dynamic = "force-dynamic";

// POST /api/seed — wipe and reseed the database with demo data + default admin user.
export async function POST() {
  try {
    const result = await seedDatabase(db);
    // If the caller isn't already authenticated, log them in as the demo admin
    // so the freshly-seeded project is immediately accessible.
    const session = await getSession();
    if (!session && result.user) {
      await setSessionCookie({ sub: result.user.id, email: result.user.email, name: result.user.name });
    }
    return NextResponse.json({
      ok: true,
      project: { id: result.project.id, name: result.project.name },
      reviewsInserted: result.reviewsInserted,
      sourcesInserted: result.sourcesInserted,
      user: result.user,
      demoCredentials: { email: "pm@reviewpulse.dev", password: "ReviewPulse123!" },
    });
  } catch (err) {
    console.error("[api/seed] failed:", err);
    return errorResponse(err);
  }
}

// GET /api/seed/status — check whether data is present without mutating.
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
