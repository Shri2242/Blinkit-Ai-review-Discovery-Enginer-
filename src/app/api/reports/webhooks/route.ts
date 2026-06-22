import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireProjectAccess, errorResponse } from "@/lib/rbac";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createWebhookSchema = z.object({
  name: z.string().min(1).max(255),
  url: z.string().url(),
  events: z.array(z.string()).min(1),
  enabled: z.boolean().default(true),
});

// GET /api/reports/webhooks?projectId=... — list webhooks (no secrets returned).
export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get("projectId") || undefined;
    const ctx = await requireProjectAccess(projectId, "viewer");
    const webhooks = await db.webhookConfig.findMany({
      where: { projectId: ctx.project!.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { deliveries: true } } },
    });
    return NextResponse.json({ webhooks: webhooks.map((w) => ({
      id: w.id, name: w.name, url: w.url, events: JSON.parse(w.events),
      enabled: w.enabled, failureCount: w.failureCount,
      lastTriggeredAt: w.lastTriggeredAt?.toISOString() ?? null,
      lastStatusCode: w.lastStatusCode, createdAt: w.createdAt.toISOString(),
      deliveryCount: w._count.deliveries,
    })) });
  } catch (err) { return errorResponse(err); }
}

// POST /api/reports/webhooks?projectId=... — create a webhook (admin). Secret is returned ONCE.
export async function POST(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get("projectId") || undefined;
    const ctx = await requireProjectAccess(projectId, "admin");
    const body = await req.json().catch(() => ({}));
    const parsed = createWebhookSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error);

    const { randomBytes } = await import("crypto");
    const secret = randomBytes(32).toString("hex");
    const webhook = await db.webhookConfig.create({
      data: {
        projectId: ctx.project!.id, createdBy: ctx.user.id,
        name: parsed.data.name, url: parsed.data.url, secret,
        events: JSON.stringify(parsed.data.events), enabled: parsed.data.enabled,
      },
    });
    return NextResponse.json({
      ok: true,
      webhook: { id: webhook.id, name: webhook.name, url: webhook.url, secret },
    });
  } catch (err) { return errorResponse(err); }
}
