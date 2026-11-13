import type { Bundle, Condition, Observation, Patient } from "fhir/r4";
import { fhirSearch } from "@/lib/fhir/client";
import type { Inputs } from "./rules";

const obs = (codes: string, count: number) =>
  `Observation?patient={{context.patientId}}&code=${codes}&_sort=-date&_count=${count}`;

/** Prefetch templates advertised in discovery. Keys are what the service reads back. */
export const PREFETCH = {
  patient: "Patient/{{context.patientId}}",
  conditions: "Condition?patient={{context.patientId}}&_count=100",
  creatinine: obs("2160-0,38483-4,14682-9", 10),
  weight: obs("29463-7", 1),
  height: obs("8302-2", 1),
  hba1c: obs("4548-4", 1),
  bp: obs("85354-9,8480-6", 1),
} as const;

const resources = <T>(value: unknown): T[] => {
  const v = value as Bundle | { resourceType?: string } | null | undefined;
  if (!v || typeof v !== "object") return [];
  if (v.resourceType === "Bundle")
    return ((v as Bundle).entry ?? []).flatMap((e) => (e.resource ? [e.resource as T] : []));
  return [v as T];
};

/** Prefetch only: the service never calls a FHIR server named in the request. Returns null when the patient is missing. */
export function inputsFromPrefetch(prefetch: Record<string, unknown> | undefined): Inputs | null {
  const patient = resources<Patient>(prefetch?.patient).find((p) => p.resourceType === "Patient");
  if (!patient) return null;
  const list = (k: keyof typeof PREFETCH) =>
    resources<Observation>(prefetch?.[k]).filter((o) => o.resourceType === "Observation");
  return {
    patient,
    conditions: resources<Condition>(prefetch?.conditions).filter((c) => c.resourceType === "Condition"),
    creatinine: list("creatinine"),
    weight: list("weight"),
    height: list("height"),
    hba1c: list("hba1c"),
    bp: list("bp"),
  };
}

/** The chart reads the same data through the same templates, from our own FHIR server. */
export async function inputsForChart(id: string, patient: Patient, conditions: Condition[]): Promise<Inputs> {
  const q = (t: string) => t.replace("{{context.patientId}}", id);
  const [creatinine, weight, height, hba1c, bp] = await Promise.all(
    (["creatinine", "weight", "height", "hba1c", "bp"] as const).map((k) =>
      fhirSearch<Observation>(q(PREFETCH[k]), { maxPages: 1 }),
    ),
  );
  return { patient, conditions, creatinine, weight, height, hba1c, bp };
}
