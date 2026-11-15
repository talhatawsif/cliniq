import { z } from "zod";
import { env, flags, invalidSettings } from "@/lib/env";
import { FhirError, fhirFetch } from "@/lib/fhir/client";

// The deep check wakes the FHIR server and calls Supabase, and the route is public: reuse one result for 30 s.
let recent: { at: number; result: ReturnType<typeof deepCheck> } | undefined;
const cachedDeepCheck = () => {
  if (!recent || Date.now() - recent.at > 30_000) recent = { at: Date.now(), result: deepCheck() };
  return recent.result;
};

type Call = { model: string; outcome: string; at: string };

/** Model calls today and the latest outcome per model, from the last 200 rows of llm_calls (no question or answer text is stored there). */
function assistantUsage(rows: unknown) {
  if (!Array.isArray(rows)) return null;
  const calls = rows as Call[];
  const today = new Date().toISOString().slice(0, 10);
  const lastByModel: Record<string, { outcome: string; at: string }> = {};
  for (const c of calls) lastByModel[c.model] ??= { outcome: c.outcome, at: c.at }; // newest first
  return { callsToday: calls.filter((c) => c.at.slice(0, 10) === today).length, lastByModel };
}

async function deepCheck() {
  const started = Date.now();
  const supabase = (path: string, init?: RequestInit) =>
    fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${path}`, {
      ...init,
      headers: { apikey: env.SUPABASE_SECRET_KEY!, Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    }).then((r) => (r.ok ? (r.json() as Promise<unknown>) : Promise.reject(new Error(String(r.status)))));
  const [fhir, db, calls] = await Promise.allSettled([
    fhirFetch("Patient?_summary=count&_count=0", { retries: 0, timeoutMs: 12_000 }),
    supabase("rpc/db_size", { method: "POST" }) as Promise<number>,
    supabase("llm_calls?select=model,outcome,at&order=at.desc&limit=200"),
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
    assistant: calls.status === "fulfilled" ? assistantUsage(calls.value) : null,
    ms: Date.now() - started,
  };
}

export async function GET(request: Request) {
  const deep = z.literal("1").safeParse(new URL(request.url).searchParams.get("deep")).success
    ? await cachedDeepCheck()
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
