import { z } from "zod";
import { audit } from "@/lib/audit";
import { FhirError } from "@/lib/fhir/client";
import { hasIntegrationKey } from "@/lib/integration";
import { runSweep } from "@/lib/tasks/sweep";
import { currentUserId } from "@/lib/supabase";

export const maxDuration = 60;
const query = z.object({ dryRun: z.enum(["0", "1"]).default("0") });

/** The weekly care-gap sweep: one FHIR Task per open gap, created once. Needs the integration key or a session. */
export async function POST(request: Request) {
  const keyed = hasIntegrationKey(request);
  const user = keyed ? null : await currentUserId();
  if (!keyed && !user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const parsed = query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ error: "dryRun must be 0 or 1" }, { status: 400 });
  try {
    const result = await runSweep({ dryRun: parsed.data.dryRun === "1" });
    if (!result.dryRun && result.created > 0)
      await audit(
        "write",
        null,
        `care-gap sweep: ${result.created} task(s)`,
        "success",
        keyed ? "integration" : (user ?? undefined),
      );
    return Response.json(result);
  } catch (e) {
    if (e instanceof FhirError)
      return Response.json({ error: "FHIR server unavailable, retry later" }, { status: 503 });
    return Response.json({ error: e instanceof Error ? e.message : "The sweep failed" }, { status: 500 });
  }
}
