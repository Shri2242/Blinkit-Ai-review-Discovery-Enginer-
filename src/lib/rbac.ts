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
  if (!session) return { user: null, project: null, membership: null };

  const user = { id: session.sub, email: session.email, name: session.name };

  // If a projectId is provided, look up that project + the user's membership.
  let project: AuthContext["project"] = null;
  let membership: AuthContext["membership"] = null;

  if (projectId) {
    const mem = await db.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
      include: { project: true },
    });
    if (mem) {
      project = {
        id: mem.project.id,
        name: mem.project.name,
        description: mem.project.description,
      };
      membership = { role: mem.role as Role };
    }
  } else {
    // Default to the user's first project (by creation order).
    const mem = await db.projectMember.findFirst({
      where: { userId: user.id },
      include: { project: true },
      orderBy: { createdAt: "asc" },
    });
    if (mem) {
      project = {
        id: mem.project.id,
        name: mem.project.name,
        description: mem.project.description,
      };
      membership = { role: mem.role as Role };
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
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });
  } catch {
    // best-effort
  }
}
