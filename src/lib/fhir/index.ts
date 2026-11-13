import type { AllergyIntolerance, Condition, Observation, Patient } from "fhir/r4";
import { fhirFetch, fhirSearch, isFhirId } from "./client";

export { FhirError } from "./client";
export * from "./display";

export function getPatients(): Promise<Patient[]> {
  return fhirSearch<Patient>("Patient?_count=50&_sort=family");
}

export type PatientDetail = {
  patient: Patient;
  observations: Observation[];
  conditions: Condition[];
  allergies: AllergyIntolerance[];
};

/** Returns null when the id is malformed or the patient does not exist. */
export async function getPatientDetail(id: string): Promise<PatientDetail | null> {
  // Also stops the id from adding query parameters or path segments.
  if (!isFhirId(id)) return null;
  const patient = await fhirFetch<Patient>(`Patient/${id}`);
  if (!patient) return null;

  const [observations, conditions, allergies] = await Promise.all([
    // First page only: full paging and grouping by analyte arrive with the pathology card (M4).
    fhirSearch<Observation>(`Observation?patient=${id}&_sort=-date&_count=20`, { maxPages: 1 }),
    fhirSearch<Condition>(`Condition?patient=${id}&clinical-status=active`),
    fhirSearch<AllergyIntolerance>(`AllergyIntolerance?patient=${id}`),
  ]);
  return { patient, observations, conditions, allergies };
}
