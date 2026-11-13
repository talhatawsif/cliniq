import { flags, invalidSettings } from "@/lib/env";

// Liveness only. The deep check (FHIR server and database) is added with the cloud FHIR card (M2).
export function GET() {
  return Response.json({
    // "degraded": a setting has a malformed value and is being ignored (names only, never values).
    status: invalidSettings.length ? "degraded" : "ok",
    invalidSettings,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    configured: flags,
  });
}
