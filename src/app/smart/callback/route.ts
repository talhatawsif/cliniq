import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { stateMatches } from "@/lib/smart/flow";
import { setSession, takeTx } from "@/lib/smart/session";

const token = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().positive().optional(),
  patient: z
    .string()
    .regex(/^[A-Za-z0-9.-]{1,64}$/)
    .optional(),
});
const fail = (message: string, status = 400) => Response.json({ error: message }, { status });

/** Checks `state`, exchanges the code (with the PKCE verifier) and stores the token in an encrypted httpOnly cookie. */
export async function GET(request: Request) {
  if (!env.SMART_CLIENT_ID || !env.SESSION_SECRET) return fail("SMART launch is not configured", 503);
  const url = new URL(request.url);
  const tx = await takeTx();
  if (!tx) return fail("No launch in progress. Start again from /smart/launch.");
  if (!stateMatches(url.searchParams.get("state"), tx.state))
    return fail("State mismatch: the response does not belong to this launch.");
  if (url.searchParams.get("error"))
    return fail(`The authorisation server refused the launch (${url.searchParams.get("error")}).`);
  const code = url.searchParams.get("code");
  if (!code) return fail("Missing authorisation code");

  const redirectUri = env.SMART_REDIRECT_URI ?? new URL("/smart/callback", url.origin).toString();
  const res = await fetch(tx.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: env.SMART_CLIENT_ID,
      code_verifier: tx.verifier,
    }),
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!res?.ok) return fail("Token exchange failed", 502);
  const parsed = token.safeParse(await res.json());
  if (!parsed.success) return fail("Unexpected token response", 502);
  if (!parsed.data.patient) return fail("The launch did not select a patient", 400);

  await setSession(
    {
      token: parsed.data.access_token,
      iss: tx.iss,
      patient: parsed.data.patient,
      exp: Math.floor(Date.now() / 1000) + (parsed.data.expires_in ?? 3600),
    },
    url.protocol === "https:",
  );
  return NextResponse.redirect(new URL(`/patient/${parsed.data.patient}`, url.origin));
}
