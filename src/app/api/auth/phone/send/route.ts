import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/rbac";
import { setOtp } from "@/lib/otp-store";
import { sendSms, isTwilioConfigured } from "@/lib/notifications";
import { z } from "zod";

export const dynamic = "force-dynamic";

const phoneSchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{6,14}$/, "Valid phone number required (E.164, e.g. +14155551234)"),
});

// POST /api/auth/phone/send — generate + send an OTP via real Twilio SMS.
// When TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_PHONE_NUMBER are set,
// a real SMS is sent. Otherwise dev mode returns the code in the response.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = phoneSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error);
    const { phone } = parsed.data;

    const code = String(Math.floor(100000 + Math.random() * 900000));
    setOtp(phone, code);

    const twilioConfigured = isTwilioConfigured();
    if (twilioConfigured) {
      const result = await sendSms(phone, `Your ReviewPulse verification code is: ${code}. It expires in 5 minutes.`);
      if (result.sent) {
        return NextResponse.json({ ok: true, sent: true, devMode: false, expiresIn: 300 });
      }
      // SMS failed but we still have the code in the store — return dev code as fallback.
      return NextResponse.json({
        ok: true, sent: false, devMode: true, devCode: code,
        hint: `Twilio send failed: ${result.error}. Using dev mode instead.`,
        expiresIn: 300,
      });
    }

    // Dev mode: return the code so the UI can display it.
    return NextResponse.json({
      ok: true,
      sent: true,
      devMode: true,
      devCode: code,
      hint: "Dev mode: use this code. Set TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_PHONE_NUMBER for real SMS.",
      expiresIn: 300,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
