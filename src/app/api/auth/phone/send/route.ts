import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { setSessionCookie } from "@/lib/auth";
import { errorResponse, logActivity } from "@/lib/rbac";
import { setOtp } from "@/lib/otp-store";
import { z } from "zod";

export const dynamic = "force-dynamic";

const phoneSchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{6,14}$/, "Valid phone number required (E.164, e.g. +14155551234)"),
});

// POST /api/auth/phone/send — generate + "send" an OTP.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = phoneSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error);
    const { phone } = parsed.data;

    const code = String(Math.floor(100000 + Math.random() * 900000));
    setOtp(phone, code);

    const smsProvider = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN;
    if (smsProvider) {
      // Real SMS send would go here via Twilio.
      console.log(`[sms] Would send OTP ${code} to ${phone} via Twilio.`);
    }

    return NextResponse.json({
      ok: true,
      sent: true,
      devMode: !smsProvider,
      ...(smsProvider ? {} : { devCode: code, hint: "Dev mode: use this code. Set TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN for real SMS." }),
      expiresIn: 300,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
