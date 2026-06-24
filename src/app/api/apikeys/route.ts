import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, errorResponse, logActivity } from "@/lib/rbac";
import { ensureProject } from "@/lib/server";
import { createApiKeySchema } from "@/lib/validation";
import { createHash, randomBytes } from "crypto";

export const dynamic = "force-dynamic";

const KEY_PREFIX = "rpk_live_";

function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const token = randomBytes(24).toString("hex");
  const raw = `${KEY_PREFIX}${token}`;
  const hash = hashKey(raw);
  const prefix = raw.slice(0, 16); // "rpk_live_" + 8 hex chars
  return { raw, hash, prefix };
}

// GET /api/apikeys — list the authenticated user's API keys (prefix only).
export async function GET() {
  try {
    const ctx = await getAuthContext();
    if (!ctx.user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }
    const keys = await db.apiKey.findMany({
      where: { userId: ctx.user.id },
      orderBy: { createdAt: "desc" },
    });
    return Response.json({
      keys: keys.map((k) => ({
        id: k.id,
        name: k.name,
        prefix: k.keyPrefix,
        lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
        createdAt: k.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

// POST /api/apikeys — generate a new API key. Raw value returned ONCE.
export async function POST(req: NextRequest) {
  try {
    const ctx = await getAuthContext();
    if (!ctx.user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const parsed = createApiKeySchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error);

    const project = await ensureProject();
    const { raw, hash, prefix } = generateApiKey();
    const key = await db.apiKey.create({
      data: { userId: ctx.user.id, projectId: project.id, name: parsed.data.name, keyHash: hash, keyPrefix: prefix },
    });
    await logActivity(ctx.user.id, "apikey.create", null, { keyId: key.id });
    return Response.json({
      ok: true,
      key: {
        id: key.id,
        name: key.name,
        raw, // shown only this once
        prefix: key.keyPrefix,
        createdAt: key.createdAt.toISOString(),
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
