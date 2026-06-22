import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureProject, serializeReview } from "@/lib/server";
import { reviewQuerySchema } from "@/lib/validation";
import { errorResponse } from "@/lib/rbac";

export const dynamic = "force-dynamic";

// GET /api/reviews — list reviews with optional filters (validated via Zod).
export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get("projectId") || undefined;
    const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = reviewQuerySchema.safeParse(sp);
    if (!parsed.success) return errorResponse(parsed.error);
    const { sentiment, source, theme, priority, rating, isBug, isFeatureRequest, search, limit, offset } = parsed.data;

    const project = await ensureProject(projectId);
    const where: Record<string, unknown> = { projectId: project.id };
    if (sentiment) where.sentiment = sentiment;
    if (source) where.source = source;
    if (theme) where.theme = theme;
    if (priority) where.priority = priority;
    if (rating) where.rating = rating;
    if (isBug === "true") where.isBug = true;
    if (isFeatureRequest === "true") where.isFeatureRequest = true;
    if (search) {
      where.OR = [
        { text: { contains: search } },
        { title: { contains: search } },
        { author: { contains: search } },
      ];
    }

    const [rows, total] = await Promise.all([
      db.review.findMany({ where, orderBy: { reviewDate: "desc" }, take: limit, skip: offset }),
      db.review.count({ where }),
    ]);

    return NextResponse.json({ reviews: rows.map(serializeReview), total, limit, offset });
  } catch (err) {
    return errorResponse(err);
  }
}
