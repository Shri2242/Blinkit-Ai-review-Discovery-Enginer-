/**
 * ReviewPulse — Notification services (server-only).
 *
 * Real SMS via Twilio, real email via Resend. Both gracefully no-op (with a
 * clear dev-mode signal) when credentials are absent. This means the app
 * "just works" the moment you paste the keys.
 */
import "server-only";

/* --------------------------------- SMS (Twilio) --------------------------------- */

export function isTwilioConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
}

export async function sendSms(phone: string, body: string): Promise<{ sent: boolean; devMode: boolean; error?: string }> {
  if (!isTwilioConfigured()) {
    return { sent: false, devMode: true, error: "Twilio not configured" };
  }
  try {
    const twilio = (await import("twilio")).default;
    const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
    const msg = await client.messages.create({
      body,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to: phone,
    });
    return { sent: true, devMode: false, error: msg.errorCode ? `Twilio error ${msg.errorCode}: ${msg.errorMessage}` : undefined };
  } catch (err) {
    return { sent: false, devMode: false, error: err instanceof Error ? err.message : "Unknown SMS error" };
  }
}

/* --------------------------------- Email (Resend) --------------------------------- */

export function isResendConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ sent: boolean; devMode: boolean; error?: string }> {
  if (!isResendConfigured()) {
    return { sent: false, devMode: true, error: "Resend not configured" };
  }
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const from = process.env.RESEND_FROM_EMAIL || "ReviewPulse <noreply@reviewpulse.dev>";
    const { data, error } = await resend.emails.send({ from, to: opts.to, subject: opts.subject, html: opts.html, text: opts.text });
    if (error) return { sent: false, devMode: false, error: error.message };
    return { sent: true, devMode: false, error: undefined };
  } catch (err) {
    return { sent: false, devMode: false, error: err instanceof Error ? err.message : "Unknown email error" };
  }
}

/* --------------------------------- Firebase Admin --------------------------------- */

export function isFirebaseConfigured(): boolean {
  return !!(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_SERVICE_ACCOUNT);
}

let firebaseApp: unknown = null;

export async function getFirebaseAuth(): Promise<{ verifyIdToken: (token: string) => Promise<unknown> } | null> {
  if (!isFirebaseConfigured()) return null;
  if (firebaseApp) return firebaseApp as { verifyIdToken: (token: string) => Promise<unknown> };
  try {
    const admin = await import("firebase-admin/app");
    const auth = await import("firebase-admin/auth");
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!);
    const app = admin.initializeApp({
      credential: admin.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID,
    }, "reviewpulse");
    const authInstance = auth.getAuth(app);
    firebaseApp = authInstance;
    return authInstance as unknown as { verifyIdToken: (token: string) => Promise<unknown> };
  } catch (err) {
    console.error("[firebase] init failed:", err);
    return null;
  }
}
