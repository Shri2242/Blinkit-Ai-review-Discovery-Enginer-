import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { db } = await import("@/lib/db");
    const userCount = await db.user.count();
    return NextResponse.json({
      ok: true,
      hasDb: true,
      userCount,
      databaseUrlConfigured: !!process.env.DATABASE_URL,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      databaseUrlConfigured: !!process.env.DATABASE_URL,
    }, { status: 500 });
  }
}
