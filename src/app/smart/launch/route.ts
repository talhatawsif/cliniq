import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import {
  DEFAULT_ISS,
  authorizeUrl,
  checkConfig,
  checkIssuer,
  chooseScopes,
  newPkce,
  newState,
  type SmartConfig,
} from "@/lib/smart/flow";
import { setTx } from "@/lib/smart/session";

/** Standalone launch (no parameters) or EHR launch (`iss` and `launch`). Redirects to the authorisation server. */
export async function GET(request: Request) {
  if (!env.SMART_CLIENT_ID || !env.SESSION_SECRET) {
    return Response.json({ error: "SMART launch is not configured" }, { status: 503 });
  }
  const url = new URL(request.url);
  const iss = checkIssuer(url.searchParams.get("iss") ?? DEFAULT_ISS);
  if (!iss)
    return Response.json(
      { error: "Unsupported issuer. Only the SMART sandbox is allowed." },
      { status: 400 },
    );
  const launch = url.searchParams.get("launch") ?? undefined;
  if (launch && !/^[\w.~-]{1,2048}$/.test(launch))
    return Response.json({ error: "Invalid launch token" }, { status: 400 });

  const res = await fetch(`${iss}/.well-known/smart-configuration`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  const config = res?.ok ? checkConfig(iss, (await res.json()) as Partial<SmartConfig>) : null;
  if (!config)
    return Response.json({ error: "The SMART server did not provide valid discovery data" }, { status: 502 });

  const { verifier, challenge } = newPkce();
  const state = newState();
  await setTx({ state, verifier, iss, tokenEndpoint: config.token_endpoint }, url.protocol === "https:");
  const redirectUri = env.SMART_REDIRECT_URI ?? new URL("/smart/callback", url.origin).toString();
  return NextResponse.redirect(
    authorizeUrl({
      config,
      clientId: env.SMART_CLIENT_ID,
      redirectUri,
      scope: chooseScopes(config, Boolean(launch)),
      state,
      challenge,
      iss,
      launch,
    }),
  );
}
