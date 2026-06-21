import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureProject } from "@/lib/server";

export const dynamic = "force-dynamic";

// GET /api/sources — list collector sources for the project.
export async function GET() {
  const project = await ensureProject();
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
}

// POST /api/sources — create a new collector source.
// Body: { sourceType, name, config, schedule?, enabled? }
export async function POST(req: NextRequest) {
  const project = await ensureProject();
  const body = await req.json().catch(() => ({}));
  const sourceType = String(body?.sourceType || "");
  const name = String(body?.name || "");
  if (!sourceType || !name) {
    return NextResponse.json({ error: "sourceType and name are required" }, { status: 400 });
  }
  const allowed = ["google_play", "app_store", "reddit", "twitter"];
  if (!allowed.includes(sourceType)) {
    return NextResponse.json({ error: "invalid sourceType" }, { status: 400 });
  }
  const config = body?.config ?? {};
  const created = await db.collectorSource.create({
    data: {
      projectId: project.id,
      sourceType,
      name,
      config: JSON.stringify(config),
      schedule: String(body?.schedule || "0 9 * * *"),
      enabled: body?.enabled !== false,
    },
  });
  return NextResponse.json({ ok: true, source: { id: created.id } });
}

function safeParse(s: string | null): Record<string, unknown> {
  if (!s) return {};
  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    return {};
  }
}
