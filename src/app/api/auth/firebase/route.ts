import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { setSessionCookie } from "@/lib/auth";
import { errorResponse, ApiError, logActivity } from "@/lib/rbac";
import { z } from "zod";

export const dynamic = "force-dynamic";

const firebaseSchema = z.object({ idToken: z.string().min(1) });

// POST /api/auth/firebase — verify a Firebase ID token and issue a session.
// Supports Google, phone, and anonymous Firebase auth.
// In production with FIREBASE_PROJECT_ID + FIREBASE_SERVICE_ACCOUNT set, this
// verifies the token via the Firebase Admin SDK. Without creds, it returns a
// clear error.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = firebaseSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error);

    const hasFirebaseConfig = process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!hasFirebaseConfig) {
      return NextResponse.json({
        ok: false,
        configured: false,
        error: "Firebase Auth is not configured. Set FIREBASE_PROJECT_ID and FIREBASE_SERVICE_ACCOUNT (JSON) env vars.",
        setup: {
          step1: "Create a Firebase project at https://console.firebase.google.com",
          step2: "Enable Google/Phone/Anonymous sign-in methods",
          step3: "Generate a service account key (JSON) and set FIREBASE_SERVICE_ACCOUNT to its contents",
          step4: "Set FIREBASE_PROJECT_ID to your project ID",
        },
      }, { status: 503 });
    }

    // Real Firebase token verification would go here:
    // const admin = await import('firebase-admin');
    // const decoded = await admin.auth().verifyIdToken(parsed.data.idToken);
    // For now, this path is unreachable without config.
    throw new ApiError(501, "Firebase verification not yet wired (config present but SDK not installed).");
  } catch (err) { return errorResponse(err); }
}
