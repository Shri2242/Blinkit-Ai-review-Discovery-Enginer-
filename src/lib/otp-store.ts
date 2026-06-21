/**
 * ReviewPulse — In-memory OTP store for phone auth.
 *
 * Shared between /api/auth/phone/send and /api/auth/phone/verify.
 * In production, replace with Redis (Upstash) keyed by phone number with a
 * 5-minute TTL and attempt limiting.
 */
export interface OtpEntry {
  code: string;
  expiresAt: number;
  attempts: number;
}

// Map<phoneE164, OtpEntry>
export const otpStore = new Map<string, OtpEntry>();

export function setOtp(phone: string, code: string) {
  otpStore.set(phone, { code, expiresAt: Date.now() + 5 * 60 * 1000, attempts: 0 });
}

export function verifyOtp(phone: string, code: string): { ok: boolean; reason?: string } {
  const entry = otpStore.get(phone);
  if (!entry) return { ok: false, reason: "No OTP requested for this number. Request a new code." };
  if (entry.expiresAt < Date.now()) {
    otpStore.delete(phone);
    return { ok: false, reason: "Code expired. Request a new one." };
  }
  if (entry.attempts >= 5) {
    otpStore.delete(phone);
    return { ok: false, reason: "Too many attempts. Request a new code." };
  }
  entry.attempts++;
  if (entry.code !== code) {
    return { ok: false, reason: `Invalid code. ${5 - entry.attempts} attempts remaining.` };
  }
  otpStore.delete(phone);
  return { ok: true };
}
