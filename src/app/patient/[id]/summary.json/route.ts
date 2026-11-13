import { audit } from "@/lib/audit";
import { loadSummary } from "@/lib/ps/load";

/** Downloads the AU Patient Summary document Bundle. Needs a session (proxy). */
export async function GET(_request: Request, ctx: RouteContext<"/patient/[id]/summary.json">) {
  const { id } = await ctx.params;
  const bundle = await loadSummary(id);
  if (!bundle) return Response.json({ error: "Patient not found" }, { status: 404 });
  await audit("export", `Patient/${id}`, "AU Patient Summary JSON");
  return new Response(JSON.stringify(bundle, null, 2), {
    headers: {
      "Content-Type": "application/fhir+json",
      "Content-Disposition": `attachment; filename="patient-summary-${id}.json"`,
    },
  });
}
