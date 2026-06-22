import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireProjectAccess, errorResponse, logActivity } from "@/lib/rbac";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createScheduleSchema = z.object({
  name: z.string().min(1).max(255),
  frequency: z.enum(["daily", "weekly", "monthly"]),
  recipients: z.array(z.string().email()).min(1),
  includeSentiment: z.boolean().default(true),
  includeThemes: z.boolean().default(true),
  includeTopIssues: z.boolean().default(true),
  includeSummary: z.boolean().default(true),
  enabled: z.boolean().default(true),
});

function calculateNextSendAt(frequency: string, from = new Date()): Date {
  const next = new Date(from);
  if (frequency === "daily") { next.setUTCDate(next.getUTCDate() + 1); next.setUTCHours(9, 0, 0, 0); }
  else if (frequency === "weekly") { const day = next.getUTCDay(); const daysToAdd = day === 0 ? 1 : 8 - day; next.setUTCDate(next.getUTCDate() + daysToAdd); next.setUTCHours(9, 0, 0, 0); }
  else if (frequency === "monthly") { next.setUTCMonth(next.getUTCMonth() + 1); next.setUTCDate(1); next.setUTCHours(9, 0, 0, 0); }
  return next;
}

// GET /api/reports/schedules?projectId=... — list report schedules.
export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get("projectId") || undefined;
    const ctx = await requireProjectAccess(projectId, "viewer");
    const schedules = await db.reportSchedule.findMany({
      where: { projectId: ctx.project!.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ schedules: schedules.map((s) => ({
      id: s.id, name: s.name, frequency: s.frequency,
      recipients: JSON.parse(s.recipients), enabled: s.enabled,
      includeSentiment: s.includeSentiment, includeThemes: s.includeThemes,
      includeTopIssues: s.includeTopIssues, includeSummary: s.includeSummary,
      lastSentAt: s.lastSentAt?.toISOString() ?? null,
      nextSendAt: s.nextSendAt?.toISOString() ?? null,
      createdAt: s.createdAt.toISOString(),
    })) });
  } catch (err) { return errorResponse(err); }
}

// POST /api/reports/schedules?projectId=... — create a report schedule (admin).
export async function POST(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get("projectId") || undefined;
    const ctx = await requireProjectAccess(projectId, "admin");
    const body = await req.json().catch(() => ({}));
    const parsed = createScheduleSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error);

    const nextSendAt = calculateNextSendAt(parsed.data.frequency);
    const schedule = await db.reportSchedule.create({
      data: {
        projectId: ctx.project!.id, createdBy: ctx.user.id,
        name: parsed.data.name, frequency: parsed.data.frequency,
        recipients: JSON.stringify(parsed.data.recipients),
        includeSentiment: parsed.data.includeSentiment,
        includeThemes: parsed.data.includeThemes,
        includeTopIssues: parsed.data.includeTopIssues,
        includeSummary: parsed.data.includeSummary,
        enabled: parsed.data.enabled, nextSendAt,
      },
    });
    await logActivity(ctx.user.id, "report.schedule_created", ctx.project!.id, { name: schedule.name });
    return NextResponse.json({ ok: true, schedule: { id: schedule.id } });
  } catch (err) { return errorResponse(err); }
}
