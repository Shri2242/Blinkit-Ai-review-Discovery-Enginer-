import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { setSessionCookie } from "@/lib/auth";
import { errorResponse, logActivity } from "@/lib/rbac";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

// POST /api/auth/guest — create a guest user (viewer role) and a session.
// The guest gets read-only access to the demo project if it exists, or their
// own empty project if it doesn't. Guests are real users with a viewer role —
// they can see everything but cannot mutate (RBAC enforced).
export async function POST() {
  try {
    const guestId = randomUUID().slice(0, 8);
    const email = `guest_${guestId}@reviewpulse.guest`;
    const name = `Guest ${guestId}`;

    const guest = await db.user.create({
      data: {
        email,
        name,
        passwordHash: null, // guests have no password
        authProvider: "guest",
      },
    });

    // Find the demo project (the first project) and add the guest as a viewer.
    // If no project exists, create an empty one owned by the guest.
    let project = await db.project.findFirst({ orderBy: { createdAt: "asc" } });
    if (project) {
      await db.projectMember.create({
        data: { projectId: project.id, userId: guest.id, role: "viewer" },
      });
    } else {
      project = await db.project.create({
        data: {
          name: "Guest Project",
          description: "A fresh project created for a guest session.",
          ownerId: guest.id,
          members: { create: { userId: guest.id, role: "admin" } },
        },
      });
    }

    await setSessionCookie({ sub: guest.id, email: guest.email, name: guest.name });
    await logActivity(guest.id, "auth.guest", project.id);

    return NextResponse.json({
      ok: true,
      user: { id: guest.id, email: guest.email, name: guest.name, authProvider: "guest" },
      project: { id: project.id, name: project.name },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
