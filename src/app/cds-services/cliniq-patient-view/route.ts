import { z } from "zod";
import { CORS, preflight } from "@/lib/cds/http";
import { inputsFromPrefetch } from "@/lib/cds/prefetch";
import { evaluate } from "@/lib/cds/rules";

export const OPTIONS = preflight;

const MAX_BYTES = 500_000;
const body = z.object({
  hook: z.literal("patient-view"),
  hookInstance: z.string().min(1).max(100),
  context: z.object({ patientId: z.string().min(1).max(100) }).loose(),
  prefetch: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  const text = await request.text();
  if (text.length > MAX_BYTES)
    return Response.json({ error: "Request too large" }, { status: 413, headers: CORS });
  let parsed;
  try {
    parsed = body.safeParse(JSON.parse(text));
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400, headers: CORS });
  }
  if (!parsed.success)
    return Response.json({ error: "Not a patient-view request" }, { status: 400, headers: CORS });

  // Prefetch only: the request's fhirServer is never called (it would be a request-forgery path).
  const inputs = inputsFromPrefetch(parsed.data.prefetch);
  return Response.json({ cards: inputs ? evaluate(inputs) : [] }, { headers: CORS });
}
