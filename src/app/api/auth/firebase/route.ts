import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { setSessionCookie } from "@/lib/auth";
import { errorResponse, ApiError, logActivity } from "@/lib/rbac";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/notifications";
import { z } from "zod";

export const dynamic = "force-dynamic";

const firebaseSchema = z.object({ idToken: z.string().min(1) });

// POST /api/auth/firebase — verify a Firebase ID token and issue a session.
// Supports Google, phone, and anonymous Firebase auth.
// When FIREBASE_PROJECT_ID + FIREBASE_SERVICE_ACCOUNT are set, verifies the
// token via the Firebase Admin SDK. Otherwise returns setup instructions.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = firebaseSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error);

    if (!isFirebaseConfigured()) {
      return NextResponse.json({
        ok: false,
        configured: false,
        error: "Firebase Auth is not configured.",
        setup: {
          step1: "Create a Firebase project at https://console.firebase.google.com",
          step2: "Enable Google/Phone/Anonymous sign-in methods",
          step3: "Project Settings → Service Accounts → Generate new private key (JSON)",
          step4: "Set FIREBASE_PROJECT_ID to your project ID",
          step5: "Set FIREBASE_SERVICE_ACCOUNT to the entire JSON contents of the key file",
        },
      }, { status: 503 });
    }

    const auth = await getFirebaseAuth();
    if (!auth) {
      throw new ApiError(500, "Firebase Admin SDK failed to initialize. Check FIREBASE_SERVICE_ACCOUNT JSON.");
    }

    const decoded = await auth.verifyIdToken(parsed.data.idToken) as {
      email?: string;
      phone_number?: string;
      name?: string;
      picture?: string;
      uid: string;
      firebase: { sign_in_provider: string };
    };

    // Resolve email: use email, or phone-based placeholder, or uid-based.
    let userEmail: string;
    if (decoded.email) userEmail = decoded.email.toLowerCase();
    else if (decoded.phone_number) userEmail = `${decoded.phone_number}@phone.reviewpulse.dev`;
    else userEmail = `${decoded.uid}@anonymous.reviewpulse.dev`;

    // Find or create user.
    let user = await db.user.findUnique({ where: { email: userEmail } });
    if (!user) {
      user = await db.user.create({
        data: {
          email: userEmail,
          name: decoded.name || decoded.phone_number || "Firebase User",
          avatarUrl: decoded.picture || null,
          passwordHash: null,
          authProvider: decoded.firebase.sign_in_provider === "phone" ? "phone" : "google",
          firebaseUid: decoded.uid,
          isActive: true,
          lastLoginAt: new Date(),
        },
      });
      // Add to first project as viewer, or create a project.
      const project = await db.project.findFirst({ orderBy: { createdAt: "asc" } });
      if (project) {
        await db.projectMember.create({ data: { projectId: project.id, userId: user.id, role: "viewer" } });
      } else {
        await db.project.create({
          data: { name: "My Project", description: "Created via Firebase sign-up.", ownerId: user.id, members: { create: { userId: user.id, role: "admin" } } },
        });
      }
    } else {
      await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    }

    await setSessionCookie({ sub: user.id, email: user.email, name: user.name });
    await logActivity(user.id, "auth.firebase", undefined, { provider: decoded.firebase.sign_in_provider });

    return NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, name: user.name, authProvider: user.authProvider },
    });
  } catch (err) { return errorResponse(err); }
}
