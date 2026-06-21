import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { seedDatabase } from "@/lib/seed-data";

export const dynamic = "force-dynamic";

// POST /api/seed — wipe and reseed the database with demo data.
export async function POST() {
  try {
    const result = await seedDatabase(db);
    return NextResponse.json({
      ok: true,
      project: { id: result.project.id, name: result.project.name },
      reviewsInserted: result.reviewsInserted,
      sourcesInserted: result.sourcesInserted,
    });
  } catch (err) {
    console.error("[api/seed] failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

// GET /api/seed/status — check whether data is present without mutating.
export async function GET() {
  const projectCount = await db.project.count();
  const reviewCount = await db.review.count();
  const sourceCount = await db.collectorSource.count();
  return NextResponse.json({
    seeded: projectCount > 0,
    projectCount,
    reviewCount,
    sourceCount,
  });
}
