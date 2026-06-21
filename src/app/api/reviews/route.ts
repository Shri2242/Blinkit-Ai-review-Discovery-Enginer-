import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureProject, serializeReview } from "@/lib/server";

export const dynamic = "force-dynamic";

// GET /api/reviews — list reviews with optional filters.
// Query params: sentiment, source, theme, priority, rating, isBug, isFeatureRequest,
//               search (keyword ILIKE), limit (default 100), offset (default 0).
export async function GET(req: NextRequest) {
  const project = await ensureProject();
  const sp = req.nextUrl.searchParams;

  const limit = Math.min(parseInt(sp.get("limit") || "100", 10) || 100, 500);
  const offset = Math.max(parseInt(sp.get("offset") || "0", 10) || 0, 0);

  const where: Record<string, unknown> = { projectId: project.id };
  if (sp.get("sentiment")) where.sentiment = sp.get("sentiment");
  if (sp.get("source")) where.source = sp.get("source");
  if (sp.get("theme")) where.theme = sp.get("theme");
  if (sp.get("priority")) where.priority = sp.get("priority");
  if (sp.get("rating")) where.rating = parseInt(sp.get("rating")!, 10);
  if (sp.get("isBug") === "true") where.isBug = true;
  if (sp.get("isFeatureRequest") === "true") where.isFeatureRequest = true;

  const search = sp.get("search")?.trim();
  if (search) {
    where.OR = [
      { text: { contains: search } },
      { title: { contains: search } },
      { author: { contains: search } },
    ];
  }

  const [rows, total] = await Promise.all([
    db.review.findMany({
      where,
      orderBy: { reviewDate: "desc" },
      take: limit,
      skip: offset,
    }),
    db.review.count({ where }),
  ]);

  return NextResponse.json({
    reviews: rows.map(serializeReview),
    total,
    limit,
    offset,
  });
}
