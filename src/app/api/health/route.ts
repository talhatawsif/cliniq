import { z } from "zod";
import { env, flags, invalidSettings } from "@/lib/env";
import { FhirError, fhirFetch } from "@/lib/fhir/client";

async function deepCheck() {
  const started = Date.now();
  const [fhir, db] = await Promise.allSettled([
    fhirFetch("Patient?_summary=count&_count=0", { retries: 0, timeoutMs: 12_000 }),
    fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/db_size`, {
      method: "POST",
      headers: { apikey: env.SUPABASE_SECRET_KEY!, Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    }).then((r) => (r.ok ? (r.json() as Promise<number>) : Promise.reject(new Error(String(r.status))))),
  ]);
  return {
    // A timeout is a scaled-to-zero server still starting, not an outage: the request has woken it, and a pinger with a
    // 30 s limit should see a 200. Any other failure is "down".
    fhir:
      fhir.status === "fulfilled" && fhir.value !== null
        ? "ok"
        : fhir.status === "rejected" && fhir.reason instanceof FhirError && fhir.reason.kind === "timeout"
          ? "waking"
          : "down",
    database: db.status === "fulfilled" ? "ok" : flags.supabase ? "down" : "not configured",
    databaseBytes: db.status === "fulfilled" ? db.value : null,
    ms: Date.now() - started,
  };
}

export async function GET(request: Request) {
  const deep = z.literal("1").safeParse(new URL(request.url).searchParams.get("deep")).success
    ? await deepCheck()
    : undefined;
  const degraded = invalidSettings.length > 0 || (deep && (deep.fhir === "down" || deep.database === "down"));
  return Response.json(
    {
      // "degraded": a setting is malformed (names only, never values) or a deep check failed.
      status: degraded ? "degraded" : "ok",
      invalidSettings,
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
      configured: flags,
      ...(deep && { deep }),
    },
    { status: deep && degraded ? 503 : 200 },
  );
}
