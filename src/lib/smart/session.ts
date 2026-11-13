import "server-only";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { open, seal } from "./seal";

export const TX_COOKIE = "smart_tx";
export const SESSION_COOKIE = "smart_session";

export type Tx = { state: string; verifier: string; iss: string; tokenEndpoint: string };
export type SmartSession = { token: string; iss: string; patient: string; exp: number };

// `secure` follows the request scheme: always true on Vercel (https), false for http://localhost.
const cookieOptions = (maxAge: number, secure: boolean) => ({
  httpOnly: true,
  secure,
  sameSite: "lax" as const,
  path: "/",
  maxAge,
});

/** The SMART session of this request, or null: no cookie, a forged or expired one, or no SESSION_SECRET. */
export async function smartSession(): Promise<SmartSession | null> {
  if (!env.SESSION_SECRET) return null;
  let jar;
  try {
    jar = await cookies();
  } catch {
    return null; // outside a request (scripts, tests)
  }
  const s = open<SmartSession>(jar.get(SESSION_COOKIE)?.value, env.SESSION_SECRET, "session");
  return s && s.exp > Date.now() / 1000 ? s : null;
}

/** Callers must hold SESSION_SECRET (checked by the launch route before anything is stored). */
export async function setTx(tx: Tx, secure: boolean) {
  (await cookies()).set(TX_COOKIE, seal(tx, env.SESSION_SECRET!, "transaction"), cookieOptions(600, secure));
}
export async function takeTx(): Promise<Tx | null> {
  const jar = await cookies();
  const tx = open<Tx>(jar.get(TX_COOKIE)?.value, env.SESSION_SECRET!, "transaction");
  jar.delete(TX_COOKIE); // one use
  return tx;
}
export async function setSession(s: SmartSession, secure: boolean) {
  (await cookies()).set(
    SESSION_COOKIE,
    seal(s, env.SESSION_SECRET!, "session"),
    cookieOptions(Math.max(60, s.exp - Math.floor(Date.now() / 1000)), secure),
  );
}
export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE);
}
