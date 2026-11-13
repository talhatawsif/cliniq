import { flags } from "@/lib/env";

// Liveness only. The deep check (FHIR server and database) is added with the cloud FHIR card (M2).
export function GET() {
  return Response.json({
    status: "ok",
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    configured: flags,
  });
}
