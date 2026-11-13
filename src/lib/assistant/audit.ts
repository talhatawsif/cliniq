import "server-only";
import { audit } from "@/lib/audit";

/** An assistant question is a view of the chart. The audit row names the patient and the outcome, never the question. */
export const auditAssistant = (patientId: string, kind: string) =>
  audit("view", `Patient/${patientId}`, `assistant:${kind}`);
