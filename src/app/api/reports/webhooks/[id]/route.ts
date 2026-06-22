import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireProjectAccess, errorResponse } from "@/lib/rbac";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// DELETE /api/reports/webhooks/[id]?projectId=... — delete a webhook (admin).
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const projectId = req.nextUrl.searchParams.get("projectId") || undefined;
    const ctx = await requireProjectAccess(projectId, "admin");
    await db.webhookConfig.deleteMany({ where: { id, projectId: ctx.project!.id } });
    return NextResponse.json({ ok: true });
  } catch (err) { return errorResponse(err); }
}

// GET /api/reports/webhooks/[id]/deliveries?projectId=... — list deliveries for a webhook.
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const projectId = req.nextUrl.searchParams.get("projectId") || undefined;
    const ctx = await requireProjectAccess(projectId, "viewer");
    const deliveries = await db.webhookDelivery.findMany({
      where: { webhookId: id },
      orderBy: { deliveredAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ deliveries: deliveries.map((d) => ({
      id: d.id, event: d.event, statusCode: d.statusCode, success: d.success,
      errorMessage: d.errorMessage, deliveredAt: d.deliveredAt.toISOString(),
    })) });
  } catch (err) { return errorResponse(err); }
}
