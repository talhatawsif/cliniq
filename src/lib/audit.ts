import "server-only";
import { after } from "next/server";
import { getPatient } from "@/lib/fhir";
import { smartSession } from "@/lib/smart/session";
import { LIMITS, consumeQuota } from "@/lib/quota";
import { admin, currentUserId } from "@/lib/supabase";

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
    // Views and sign-ins are open to any visitor of the demo: capped per day so a loop cannot fill the database.
    // Writes and reviews are always recorded.
    if (
      (action === "view" || action === "sign-in") &&
      !(await consumeQuota("audit", LIMITS.audit).catch(() => true))
    )
      return;
    const { error } = await admin().from("audit_events").insert({ agent, action, entity, outcome, detail });
    if (error) console.error("audit write failed:", error.code);
  });
}

/** Records that a patient chart tab was opened (once per render). Unknown ids are not recorded. */
export async function auditChartView(patientId: string, tab: string) {
  if (await getPatient(patientId)) await audit("view", `Patient/${patientId}`, tab);
}
