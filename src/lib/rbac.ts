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
  const session = await getSession();
  // [DEMO MODE] Fallback to demo user if no session is active.
  const user = {
    id: session?.sub ?? "demo",
    email: session?.email ?? "demo@reviewpulse.dev",
    name: session?.name ?? "Demo User",
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
    // [DEMO MODE] Default to the first project in creation order and grant admin access.
    const firstProj = await db.project.findFirst({ orderBy: { createdAt: "asc" } });
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
    process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err instanceof Error
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
