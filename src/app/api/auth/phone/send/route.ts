import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/rbac";
// [DEMO MODE] Twilio imports commented out
// import { setOtp } from "@/lib/otp-store";
// import { sendSms, isTwilioConfigured } from "@/lib/notifications";
import { z } from "zod";

export const dynamic = "force-dynamic";

const phoneSchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{6,14}$/, "Valid phone number required (E.164, e.g. +14155551234)"),
});

// POST /api/auth/phone/send — generate + send an OTP via real Twilio SMS.
// [DEMO MODE] SMS disabled.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = phoneSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error);
    const { phone } = parsed.data;

    // [DEMO MODE] Original Twilio implementation:
    // const code = String(Math.floor(100000 + Math.random() * 900000));
    // setOtp(phone, code);
    // if (isTwilioConfigured()) { await sendSms(...) }

    return NextResponse.json({
      ok: true,
      sent: false,
      devMode: true,
      devCode: "123456",
      message: "SMS not available in demo",
      expiresIn: 300,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

