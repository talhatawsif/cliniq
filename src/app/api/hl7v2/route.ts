import { z } from "zod";
import { hasIntegrationKey } from "@/lib/integration";
import { FhirError } from "@/lib/fhir";
import { guardRequest } from "@/lib/quota";
import { runHl7 } from "@/lib/hl7v2/server";
import { currentUserId } from "@/lib/supabase";

const query = z.object({ dryRun: z.enum(["0", "1"]).default("0") });

/** Text body in, HL7 ACK out. Needs a session, or the integration key in `x-api-key`. */
export async function POST(request: Request) {
  const keyed = hasIntegrationKey(request);
  const user = keyed ? null : await currentUserId();
  if (!keyed && !user) return Response.json({ error: "Sign in required" }, { status: 401 });

  const parsed = query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ error: "dryRun must be 0 or 1" }, { status: 400 });

  const body = await guardRequest(request, "hl7");
  if (body instanceof Response) return body;
  try {
    const result = await runHl7(body, {
      dryRun: parsed.data.dryRun === "1",
      agent: keyed ? "integration" : (user ?? undefined),
    });
    return new Response(result.ack, { headers: { "Content-Type": "application/hl7-v2; charset=utf-8" } });
  } catch (e) {
    if (e instanceof FhirError)
      return Response.json({ error: "FHIR server unavailable, retry later" }, { status: 503 });
    throw e;
  }
}
