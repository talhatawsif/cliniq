import { audit } from "@/lib/audit";
import { FhirError } from "@/lib/fhir";
import { loadSummary } from "@/lib/ps/load";

/** Downloads the AU Patient Summary document Bundle. Needs a session (proxy). */
export async function GET(_request: Request, ctx: RouteContext<"/patient/[id]/summary.json">) {
  const { id } = await ctx.params;
  let bundle;
  try {
    bundle = await loadSummary(id);
  } catch (e) {
    if (e instanceof FhirError)
      return Response.json({ error: "FHIR server unavailable, retry later" }, { status: 503 });
    throw e;
  }
  if (!bundle) return Response.json({ error: "Patient not found" }, { status: 404 });
  await audit("export", `Patient/${id}`, "AU Patient Summary JSON");
  return new Response(JSON.stringify(bundle, null, 2), {
    headers: {
      "Content-Type": "application/fhir+json",
      "Content-Disposition": `attachment; filename="patient-summary-${id}.json"`,
    },
  });
}
