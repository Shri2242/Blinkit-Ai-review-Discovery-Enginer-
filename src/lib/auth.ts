/**
 * ReviewPulse — Authentication library (server-only, zero external deps).
 *
 * Password hashing: Node `crypto.scrypt` (RFC 7914, memory-hard KDF). Format:
 *   `scrypt$N$r$p$saltHex$hashHex`  (parameters + salt + derived key)
 *
 * JWT: HS256 signed with `crypto.createHmac`. Header.payload.signature, each
 * base64url-encoded. Verified on every protected request. 7-day expiry.
 *
 * Session: the JWT is carried in an httpOnly cookie named `rp_session`.
 */
import "server-only";
import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHmac,
  randomUUID,
} from "crypto";
import { cookies } from "next/headers";

const SESSION_COOKIE = "rp_session";
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

// Read the JWT secret with a safe dev fallback (logged once).
const JWT_SECRET =
  process.env.JWT_SECRET ||
  "dev-only-secret-change-in-production-please-set-JWT_SECRET";

if (!process.env.JWT_SECRET && process.env.NODE_ENV !== "production") {
  console.warn(
    "[auth] JWT_SECRET not set — using insecure dev default. Set JWT_SECRET in production.",
  );
}

/* ----------------------------- Password hashing ----------------------------- */

/** SCrypt parameters (N, r, p). N=2^15 is a strong, modern default. */
const SCRYPT_N = 1 << 15;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 32;

export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 128 * SCRYPT_N * SCRYPT_R * 2,
  });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  try {
    const parts = stored.split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;
    const N = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    const salt = Buffer.from(parts[4], "hex");
    const expected = Buffer.from(parts[5], "hex");
    const derived = scryptSync(plain, salt, expected.length, {
      N,
      r,
      p,
      maxmem: 128 * N * r * 2,
    });
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/* --------------------------------- JWT (HS256) --------------------------------- */

interface JwtPayload {
  sub: string; // userId
  email: string;
  name: string;
  iat: number;
  exp: number;
  jti: string;
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64url");
}

function signSegment(data: string): string {
  return createHmac("sha256", JWT_SECRET).update(data).digest("base64url");
}

export function signJwt(payload: Pick<JwtPayload, "sub" | "email" | "name">): string {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const full: JwtPayload = {
    ...payload,
    iat: now,
    exp: now + SESSION_MAX_AGE_SECONDS,
    jti: randomUUID(),
  };
  const encHeader = base64url(JSON.stringify(header));
  const encPayload = base64url(JSON.stringify(full));
  const signingInput = `${encHeader}.${encPayload}`;
  const sig = signSegment(signingInput);
  return `${signingInput}.${sig}`;
}

export function verifyJwt(token: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [encHeader, encPayload, sig] = parts;
  const expectedSig = signSegment(`${encHeader}.${encPayload}`);
  // Constant-time-ish comparison.
  if (sig.length !== expectedSig.length) return null;
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (!timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(encPayload, "base64url").toString("utf8")) as JwtPayload;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // expired
    }
    return payload;
  } catch {
    return null;
  }
}

/* --------------------------------- Session (cookies) --------------------------------- */

/** Read the session JWT from the incoming request cookies. */
export async function getSession(): Promise<JwtPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyJwt(token);
}

/** Set the session cookie on a response (login/register). */
export async function setSessionCookie(payload: Pick<JwtPayload, "sub" | "email" | "name">) {
  const token = signJwt(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/** Clear the session cookie (logout). */
export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
