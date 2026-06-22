import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, errorResponse } from "@/lib/rbac";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// DELETE /api/searches/[id] — delete a saved search.
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext();
    if (!ctx.user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const search = await db.savedSearch.findUnique({ where: { id } });
    if (!search || search.userId !== ctx.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await db.savedSearch.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) { return errorResponse(err); }
}
