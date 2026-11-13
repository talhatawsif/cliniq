import { createSign } from "node:crypto";
import { env } from "@/lib/env";

let cached: { token: string; exp: number } | undefined;

const b64 = (v: object) => Buffer.from(JSON.stringify(v)).toString("base64url");

/** ID token for the private Cloud Run FHIR server, signed with the cliniq-web key (GCP_SA_KEY). */
export async function fhirAuthHeader(audience: string): Promise<Record<string, string>> {
  if (env.FHIR_AUTH !== "gcp-iam") return {};
  if (!env.GCP_SA_KEY) throw new Error("GCP_SA_KEY is not set");
  const now = Math.floor(Date.now() / 1000);
  if (!cached || cached.exp - 60 < now) {
    const key = JSON.parse(env.GCP_SA_KEY) as { client_email: string; private_key: string };
    const claims = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
      iss: key.client_email,
      sub: key.client_email,
      aud: "https://oauth2.googleapis.com/token",
      target_audience: audience,
      iat: now,
      exp: now + 3600,
    })}`;
    const jwt = `${claims}.${createSign("RSA-SHA256").update(claims).sign(key.private_key, "base64url")}`;
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Google token exchange failed (${res.status})`);
    const { id_token } = (await res.json()) as { id_token: string };
    cached = { token: id_token, exp: now + 3500 };
  }
  return { Authorization: `Bearer ${cached.token}` };
}
