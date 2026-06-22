import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, errorResponse } from "@/lib/rbac";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createSearchSchema = z.object({
  name: z.string().min(1).max(255),
  filters: z.record(z.string(), z.any()),
});

// GET /api/searches?projectId=... — list saved searches for the current user.
export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get("projectId") || undefined;
    const ctx = await getAuthContext(projectId);
    if (!ctx.user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (!ctx.project) return NextResponse.json({ error: "No project access" }, { status: 403 });
    const searches = await db.savedSearch.findMany({
      where: { projectId: ctx.project.id, userId: ctx.user.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ searches: searches.map((s) => ({
      id: s.id, name: s.name, filters: JSON.parse(s.filters), createdAt: s.createdAt.toISOString(),
    })) });
  } catch (err) { return errorResponse(err); }
}

// POST /api/searches?projectId=... — save a search.
export async function POST(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get("projectId") || undefined;
    const ctx = await getAuthContext(projectId);
    if (!ctx.user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (!ctx.project) return NextResponse.json({ error: "No project access" }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const parsed = createSearchSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error);
    const search = await db.savedSearch.create({
      data: { projectId: ctx.project.id, userId: ctx.user.id, name: parsed.data.name, filters: JSON.stringify(parsed.data.filters) },
    });
    return NextResponse.json({ ok: true, search: { id: search.id } });
  } catch (err) { return errorResponse(err); }
}
