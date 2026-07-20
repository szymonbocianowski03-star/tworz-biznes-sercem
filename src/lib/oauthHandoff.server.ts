import { createHmac, timingSafeEqual } from "crypto";

/**
 * Short-lived signed handoff nonces used instead of embedding the full Supabase
 * access token in OAuth start URLs. Verified server-side to look up user_id.
 */
const HANDOFF_TTL_SECONDS = 120;

function getSecret(): string {
  const s =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_JWT_SECRET ||
    "";
  if (!s) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for handoff signing.");
  return s;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function signHandoff(userId: string): string {
  const payload = { uid: userId, exp: Math.floor(Date.now() / 1000) + HANDOFF_TTL_SECONDS };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(createHmac("sha256", getSecret()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyHandoff(token: string | null | undefined): string | null {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    const expected = createHmac("sha256", getSecret()).update(body).digest();
    const provided = b64urlDecode(sig);
    if (provided.length !== expected.length) return null;
    if (!timingSafeEqual(provided, expected)) return null;
    const payload = JSON.parse(b64urlDecode(body).toString("utf8")) as { uid?: string; exp?: number };
    if (!payload.uid || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload.uid;
  } catch {
    return null;
  }
}