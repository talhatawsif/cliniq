// FHIR Task for an open care gap. Pure: no I/O. One Task per patient and gap, created conditionally on an identifier.
import type { Bundle, BundleEntry, Task } from "fhir/r4";
import type { CareGap } from "../cds/rules";

export const GAP_ID = "http://cliniq.example/fhir/identifier/care-gap";
export const gapKey = (patientId: string, type: CareGap["type"]) => `${patientId}|${type}`;

export function buildGapTask(patientId: string, gap: CareGap, now: Date): BundleEntry {
  const key = gapKey(patientId, gap.type);
  const task: Task = {
    resourceType: "Task",
    meta: {
      tag: [
        {
          system: "https://github.com/talhatawsif/cliniq/fhir/CodeSystem/tags",
          code: "care-gap-sweep",
          display: "Created by the care-gap sweep",
        },
      ],
    },
    identifier: [{ system: GAP_ID, value: key }],
    status: "requested",
    intent: "order",
    priority: "routine",
    code: { text: "Care gap follow-up" },
    description: `${gap.summary}. ${gap.detail}`,
    for: { reference: `Patient/${patientId}` },
    authoredOn: now.toISOString(),
  };
  return {
    fullUrl: `urn:uuid:${crypto.randomUUID()}`,
    resource: task,
    // Conditional create: if a Task with this identifier exists (open or closed) nothing is created.
    request: { method: "POST", url: "Task", ifNoneExist: `identifier=${GAP_ID}|${encodeURIComponent(key)}` },
  };
}

export const gapBundle = (entries: BundleEntry[]): Bundle => ({
  resourceType: "Bundle",
  type: "transaction",
  entry: entries,
});

/** From a transaction response: how many entries were created (201) and how many already existed (200). */
export function countResponses(response: Bundle) {
  const statuses = (response.entry ?? []).map((e) => e.response?.status ?? "");
  return {
    created: statuses.filter((s) => s.startsWith("201")).length,
    existing: statuses.filter((s) => s.startsWith("200")).length,
  };
}
