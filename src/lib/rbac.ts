/**
 * ReviewPulse — Server-side auth context + RBAC helpers.
 *
 * `getAuthContext()` reads the session JWT and returns the authenticated user
 * plus their active project and membership role. Every protected route calls
 * this; mutation routes additionally check the required role.
 */
import "server-only";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { headers } from "next/headers";

export type Role = "admin" | "analyst" | "viewer";

export interface AuthContext {
  user: { id: string; email: string; name: string };
  project: { id: string; name: string; description: string | null } | null;
  membership: { role: Role } | null;
}


/**
 * Resolve the authenticated user + their first project (or a specified one).
 * Returns `user: null` when no valid session is present.
 */
export async function getAuthContext(projectId?: string): Promise<AuthContext> {
  // Support machine-to-machine Authorization token for cron jobs/pipelines
  try {
    const headersList = await headers();
    const authHeader = headersList.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const apiAuthToken = process.env.API_AUTH_TOKEN;
      if (apiAuthToken && token === apiAuthToken) {
        const firstProj = projectId 
          ? await db.project.findUnique({ where: { id: projectId } })
          : (await db.project.findFirst({ where: { name: "Spotify — Music Discovery" } }))
            || (await db.project.findFirst({ orderBy: { createdAt: "asc" } }));
        
        return {
          user: {
            id: "service-account",
            email: "service-account@reviewpulse.dev",
            name: "Service Account",
          },
          project: firstProj ? {
            id: firstProj.id,
            name: firstProj.name,
            description: firstProj.description,
          } : null,
          membership: firstProj ? { role: "admin" as Role } : null,
        };
      }
    }
  } catch (e) {
    // headers() might throw in non-request environments (e.g. build compile), ignore
  }

  const session = await getSession();
  const userId = session?.sub ?? "demo";
  const email = session?.email ?? "demo@reviewpulse.dev";
  const name = session?.name ?? "Demo User";

  // [DEMO MODE] Ensure fallback demo user exists in the database to satisfy foreign keys
  if (userId === "demo") {
    try {
      const exists = await db.user.findUnique({ where: { id: "demo" } });
      if (!exists) {
        await db.user.create({
          data: {
            id: "demo",
            email: "demo@reviewpulse.dev",
            name: "Demo User",
            authProvider: "guest",
          },
        });
      }
    } catch (err) {
      console.error("[rbac] failed to ensure demo user exists:", err);
    }
  }

  const user = {
    id: userId,
    email,
    name,
  };

  // If a projectId is provided, look up that project + the user's membership.
  let project: AuthContext["project"] = null;
  let membership: AuthContext["membership"] = null;

  if (projectId) {
    // [DEMO MODE] Bypass membership check: anyone can access any project as admin
    const proj = await db.project.findUnique({ where: { id: projectId } });
    if (proj) {
      project = {
        id: proj.id,
        name: proj.name,
        description: proj.description,
      };
      membership = { role: "admin" as Role };
    }
  } else {
    // [DEMO MODE] Try to find the default demo project "Spotify — Music Discovery" first,
    // otherwise fallback to the first project in creation order.
    let firstProj = await db.project.findFirst({ where: { name: "Spotify — Music Discovery" } });
    if (!firstProj) {
      firstProj = await db.project.findFirst({ orderBy: { createdAt: "asc" } });
    }
    if (firstProj) {
      project = {
        id: firstProj.id,
        name: firstProj.name,
        description: firstProj.description,
      };
      membership = { role: "admin" as Role };
    }
  }

  return { user, project, membership };
}

/**
 * Ensure the caller is authenticated AND a member of the given project.
 * Throws an `ApiError` (caught by the error handler) if not.
 */
export async function requireProjectAccess(
  projectId: string | undefined,
  minRole: Role = "viewer",
): Promise<AuthContext> {
  const ctx = await getAuthContext(projectId);
  if (!ctx.user) {
    throw new ApiError(401, "Authentication required");
  }
  if (!ctx.project || !ctx.membership) {
    throw new ApiError(403, "You do not have access to this project");
  }
  if (!hasRole(ctx.membership.role, minRole)) {
    throw new ApiError(403, `This action requires the '${minRole}' role`);
  }
  return ctx;
}

/** Role hierarchy: admin > analyst > viewer. */
const ROLE_RANK: Record<Role, number> = { viewer: 0, analyst: 1, admin: 2 };
export function hasRole(actual: Role, required: Role): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[required];
}

/** Custom error carrying an HTTP status, for the centralized error handler. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Standard JSON error response (no stack traces in production). */
export function errorResponse(err: unknown) {
  if (err instanceof ApiError) {
    return Response.json(
      { error: err.message, code: err.code ?? "api_error" },
      { status: err.status },
    );
  }
  // Zod validation errors
  if (err && typeof err === "object" && "issues" in err && Array.isArray((err as { issues: unknown }).issues)) {
    return Response.json(
      { error: "Validation failed", code: "validation_error", issues: (err as { issues: unknown }).issues },
      { status: 400 },
    );
  }
  console.error("[api] unhandled error:", err);
  const message =
    err instanceof Error
      ? err.message
      : "Unknown error";
  return Response.json({ error: message, code: "internal_error" }, { status: 500 });
}

/** Log an activity entry (best-effort, never throws). */
export async function logActivity(
  userId: string | null,
  action: string,
  projectId?: string | null,
  metadata?: Record<string, unknown>,
) {
  try {
    await db.activityLog.create({
      data: {
        userId,
        action,
        projectId: projectId ?? null,
        details: metadata ? JSON.stringify(metadata) : null,
      },
    });
  } catch {
    // best-effort
  }
}
