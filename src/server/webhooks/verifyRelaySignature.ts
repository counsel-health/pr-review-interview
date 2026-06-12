/**
 * Verifies an HMAC-SHA256 signature on an inbound Relay webhook using the
 * shared secret in RELAY_WEBHOOK_SECRET. Uses a constant-time compare to
 * avoid leaking length / equality information through timing.
 */

import { createHmac, timingSafeEqual } from "crypto";

export function verifyRelaySignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret = process.env.RELAY_WEBHOOK_SECRET
): boolean {
  if (!secret) return false;
  if (!signatureHeader) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signatureHeader, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function signRelayPayload(
  rawBody: string,
  secret = process.env.RELAY_WEBHOOK_SECRET
): string {
  if (!secret) throw new Error("RELAY_WEBHOOK_SECRET is not set");
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}
