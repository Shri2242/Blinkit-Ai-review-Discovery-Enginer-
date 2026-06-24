import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureProject } from "@/lib/server";
// [DEMO MODE] RBAC import commented out — re-enable for production
// import { requireProjectAccess, errorResponse } from "@/lib/rbac";
import { errorResponse } from "@/lib/rbac";
import { createSourceSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/sources — list collector sources for the active project.
// [DEMO MODE] Auth gate removed — uses first project.
export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get("projectId") || undefined;

    // [DEMO MODE] Original auth-gated implementation:
    // const ctx = await requireProjectAccess(projectId, "viewer");
    // const project = ctx.project!;

    const project = await ensureProject(projectId);
    const sources = await db.collectorSource.findMany({
      where: { projectId: project.id },
      include: { logs: { orderBy: { startedAt: "desc" }, take: 5 } },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({
      sources: sources.map((s) => ({
        id: s.id,
        sourceType: s.sourceType,
        name: s.name,
        config: safeParse(s.config),
        enabled: s.enabled,
        schedule: s.schedule,
        lastRunAt: s.lastRunAt?.toISOString() ?? null,
        lastRunStatus: s.lastRunStatus,
        lastRunCount: s.lastRunCount,
        totalCollected: s.totalCollected,
        errorMessage: s.errorMessage,
        createdAt: s.createdAt.toISOString(),
        recentLogs: s.logs.map((l) => ({
          id: l.id,
          status: l.status,
          reviewsFetched: l.reviewsFetched,
          reviewsNew: l.reviewsNew,
          reviewsDuplicate: l.reviewsDuplicate,
          durationMs: l.durationMs,
          startedAt: l.startedAt.toISOString(),
          completedAt: l.completedAt?.toISOString() ?? null,
        })),
      })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

// POST /api/sources — create a new collector source.
// [DEMO MODE] Auth gate removed — uses first project (admin operations permitted in demo).
export async function POST(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get("projectId") || undefined;

    // [DEMO MODE] Original auth-gated implementation:
    // const ctx = await requireProjectAccess(projectId, "admin");
    // const project = ctx.project!;

    const project = await ensureProject(projectId);
    const body = await req.json().catch(() => ({}));
    const parsed = createSourceSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error);

    const created = await db.collectorSource.create({
      data: {
        projectId: project.id,
        sourceType: parsed.data.sourceType,
        name: parsed.data.name,
        config: JSON.stringify(parsed.data.config),
        schedule: parsed.data.schedule,
        enabled: parsed.data.enabled,
      },
    });
    return NextResponse.json({ ok: true, source: { id: created.id } });
  } catch (err) {
    return errorResponse(err);
  }
}

function safeParse(s: string | null): Record<string, unknown> {
  if (!s) return {};
  try { return JSON.parse(s) as Record<string, unknown>; } catch { return {}; }
}

