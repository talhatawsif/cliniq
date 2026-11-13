// Encrypts small JSON values for httpOnly cookies: AES-256-GCM, key derived from SESSION_SECRET.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const key = (secret: string, purpose: string) =>
  createHash("sha256").update(`${purpose}\0${secret}`).digest();

export function seal(value: unknown, secret: string, purpose: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(secret, purpose), iv);
  const data = Buffer.concat([c.update(JSON.stringify(value), "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), data]).toString("base64url");
}

/** The value, or null if the cookie is missing, tampered with, or sealed for another purpose or secret. */
export function open<T>(sealed: string | undefined, secret: string, purpose: string): T | null {
  if (!sealed) return null;
  try {
    const buf = Buffer.from(sealed, "base64url");
    const d = createDecipheriv("aes-256-gcm", key(secret, purpose), buf.subarray(0, 12));
    d.setAuthTag(buf.subarray(12, 28));
    return JSON.parse(Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString("utf8")) as T;
  } catch {
    return null;
  }
}
