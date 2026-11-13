// SMART App Launch helpers: pure functions, no I/O, no app imports.
import { createHash, randomBytes } from "node:crypto";

/** Only this origin may be used as `iss`: the app never follows a launch to an arbitrary server. */
export const ALLOWED_ISS_ORIGINS = ["https://launch.smarthealthit.org"];
// The sandbox encodes the launch type in the base URL; this one is "provider standalone" (it shows its own patient picker).
export const DEFAULT_ISS =
  "https://launch.smarthealthit.org/v/r4/sim/WzIsIiIsIiIsIkFVVE8iLDAsMCwwLCIiLCIiLCIiLCIiLCIiLCIiLCIiLDAsMSwiIl0/fhir";

export type SmartConfig = {
  authorization_endpoint: string;
  token_endpoint: string;
  code_challenge_methods_supported?: string[];
  capabilities?: string[];
};

const b64url = (b: Buffer) => b.toString("base64url");

/** PKCE: a random verifier and its S256 challenge. */
export function newPkce() {
  const verifier = b64url(randomBytes(48)); // 64 chars, within RFC 7636's 43-128
  return { verifier, challenge: pkceChallenge(verifier) };
}
export const pkceChallenge = (verifier: string) => b64url(createHash("sha256").update(verifier).digest());
export const newState = () => b64url(randomBytes(24));

/** The issuer URL if it is on the allowlist, else null. */
export function checkIssuer(iss: string | null | undefined): string | null {
  if (!iss) return null;
  try {
    const u = new URL(iss);
    return u.protocol === "https:" && ALLOWED_ISS_ORIGINS.includes(u.origin) ? iss.replace(/\/$/, "") : null;
  } catch {
    return null;
  }
}

/** Discovery must point at the same host as the issuer. */
export function checkConfig(iss: string, c: Partial<SmartConfig>): SmartConfig | null {
  const origin = new URL(iss).origin;
  for (const u of [c.authorization_endpoint, c.token_endpoint]) {
    if (!u || new URL(u).origin !== origin) return null;
  }
  return c as SmartConfig;
}

/** `.rs` scopes (SMART v2) when the server supports them, else `.read` (v1). */
export function chooseScopes(c: Pick<SmartConfig, "capabilities">, launching: boolean) {
  const v2 = c.capabilities?.includes("permission-v2");
  return [
    "openid",
    "fhirUser",
    launching ? "launch" : "launch/patient",
    v2 ? "patient/*.rs" : "patient/*.read",
  ].join(" ");
}

export function authorizeUrl(a: {
  config: SmartConfig;
  clientId: string;
  redirectUri: string;
  scope: string;
  state: string;
  challenge: string;
  iss: string;
  launch?: string;
}) {
  const u = new URL(a.config.authorization_endpoint);
  const set = (k: string, v: string) => u.searchParams.set(k, v);
  set("response_type", "code");
  set("client_id", a.clientId);
  set("redirect_uri", a.redirectUri);
  set("scope", a.scope);
  set("state", a.state);
  set("aud", a.iss);
  set("code_challenge", a.challenge);
  set("code_challenge_method", "S256");
  if (a.launch) set("launch", a.launch);
  return u.toString();
}

/** True only when the returned state equals the one stored for this browser. */
export function stateMatches(returned: string | null, stored: string | undefined) {
  if (!returned || !stored || returned.length !== stored.length) return false;
  let diff = 0;
  for (let i = 0; i < stored.length; i++) diff |= returned.charCodeAt(i) ^ stored.charCodeAt(i);
  return diff === 0;
}
