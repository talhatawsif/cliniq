import "server-only";
import type { Bundle, OperationOutcome } from "fhir/r4";
import { audit } from "@/lib/audit";
import { fhirFetch, fhirPost } from "@/lib/fhir/client";
import { admin } from "@/lib/supabase";
import { type Deps, type Result, processMessage } from "./process";

const errorsOf = (json: unknown) =>
  ((json as OperationOutcome | null)?.issue ?? [])
    .filter((i) => i.severity === "error" || i.severity === "fatal")
    .map((i) => `${i.expression?.[0] ?? ""} ${i.diagnostics ?? i.details?.text ?? i.code}`.trim());

/** Real dependencies: HAPI for patients, validation and writes; Supabase for the message log. */
export const liveDeps: Deps = {
  async findPatientIds(query) {
    const bundle = await fhirFetch<Bundle>(`${query}&_elements=id`);
    return (bundle?.entry ?? []).flatMap((e) => (e.resource?.id ? [e.resource.id] : []));
  },
  async validate(bundle) {
    const { status, json } = await fhirPost("Bundle/$validate", bundle);
    const errors = errorsOf(json);
    return errors.length || status < 400 ? errors : [`validation request failed with status ${status}`];
  },
  async write(bundle) {
    const { status, json } = await fhirPost("", bundle);
    if (status >= 400) throw new Error(`FHIR write failed: ${status} ${errorsOf(json)[0] ?? ""}`);
  },
  async alreadyAccepted(controlId) {
    const { count } = await admin()
      .from("hl7_messages")
      .select("id", { count: "exact", head: true })
      .eq("control_id", controlId)
      .eq("status", "accepted");
    return (count ?? 0) > 0;
  },
  async log(row) {
    const { error } = await admin().from("hl7_messages").insert({
      control_id: row.controlId,
      message_type: row.messageType,
      status: row.status,
      outcome: row.outcome,
      raw: row.raw,
    });
    if (error) throw new Error(`message log write failed: ${error.code}`);
  },
};

/** Processes one message against the live servers. Writes are audited (agent: a user id or "integration"). */
export async function runHl7(text: string, opts: { dryRun?: boolean; agent?: string }): Promise<Result> {
  const result = await processMessage(text, liveDeps, { dryRun: opts.dryRun });
  if (result.status === "accepted") {
    const subject = result.bundle?.entry?.[0]?.resource as { subject?: { reference?: string } } | undefined;
    await audit("write", subject?.subject?.reference ?? null, "hl7v2 ORU^R01", "success", opts.agent);
  }
  return result;
}
