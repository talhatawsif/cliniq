import "server-only";
import { after } from "next/server";
import { getPatient } from "@/lib/fhir";
import { smartSession } from "@/lib/smart/session";
import { currentUserId } from "@/lib/supabase";
import { admin } from "@/lib/supabase";

export type AuditAction = "view" | "export" | "write" | "review" | "sign-in";

/** One audit row, written after the response. `entity` is a FHIR reference; `detail` never holds patient content. */
export async function audit(
  action: AuditAction,
  entity: string | null,
  detail?: string,
  outcome = "success",
  agentOverride?: string,
) {
  const agent =
    agentOverride ?? (await currentUserId()) ?? ((await smartSession()) ? "smart-launch" : "anonymous");
  after(async () => {
    const { error } = await admin().from("audit_events").insert({ agent, action, entity, outcome, detail });
    if (error) console.error("audit write failed:", error.code);
  });
}

/** Records that a patient chart tab was opened (once per render). Unknown ids are not recorded. */
export async function auditChartView(patientId: string, tab: string) {
  if (await getPatient(patientId)) await audit("view", `Patient/${patientId}`, tab);
}
