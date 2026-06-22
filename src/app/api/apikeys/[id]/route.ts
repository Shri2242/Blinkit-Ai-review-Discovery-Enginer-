import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, errorResponse, logActivity } from "@/lib/rbac";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// DELETE /api/apikeys/:id — revoke an API key.
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext();
    if (!ctx.user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }
    const key = await db.apiKey.findUnique({ where: { id } });
    if (!key || key.userId !== ctx.user.id) {
      return Response.json({ error: "Key not found" }, { status: 404 });
    }
    await db.apiKey.delete({ where: { id } });
    await logActivity(ctx.user.id, "apikey.revoke", null, { keyId: id });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
