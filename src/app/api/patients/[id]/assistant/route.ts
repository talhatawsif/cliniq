import { z } from "zod";
import { auditAssistant } from "@/lib/assistant/audit";
import { runAssistant } from "@/lib/assistant/server";
import { FhirError, isFhirId } from "@/lib/fhir/client";
import { currentUserId } from "@/lib/supabase";

// A patientId (or anything else) in the body is dropped by the schema: the patient is the one in the URL.
const body = z.object({ question: z.string().trim().min(1).max(500) });

export async function POST(request: Request, ctx: RouteContext<"/api/patients/[id]/assistant">) {
  if (!(await currentUserId())) return Response.json({ error: "Sign in required" }, { status: 401 });
  const { id } = await ctx.params;
  if (!isFhirId(id)) return Response.json({ error: "Unknown patient" }, { status: 404 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: "A question of up to 500 characters is required" }, { status: 400 });
  try {
    const result = await runAssistant(id, parsed.data.question);
    if (!result) return Response.json({ error: "Unknown patient" }, { status: 404 });
    await auditAssistant(id, result.kind);
    return Response.json(result);
  } catch (e) {
    if (e instanceof FhirError)
      return Response.json({ error: "The record could not be read" }, { status: 503 });
    throw e;
  }
}
