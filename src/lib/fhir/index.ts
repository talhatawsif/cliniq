import type {
  AllergyIntolerance,
  Bundle,
  Condition,
  Encounter,
  Immunization,
  Medication,
  MedicationRequest,
  Patient,
} from "fhir/r4";
import { fhirFetch, fhirSearch, isFhirId } from "./client";
import { IHI_SYSTEM } from "./clinical";

export { FhirError } from "./client";
export * from "./clinical";
export * from "./display";

export const PAGE_SIZE = 20;

/** One page of patients. A 16-digit query is an IHI search; anything else searches by name. */
export async function getPatientsPage(q: string, page: number) {
  const digits = q.replace(/\s/g, "");
  const filter = !q
    ? ""
    : /^\d{16}$/.test(digits)
      ? `&identifier=${IHI_SYSTEM}|${digits}`
      : `&name=${encodeURIComponent(q)}`;
  const offset = (Math.max(page, 1) - 1) * PAGE_SIZE;
  const bundle = await fhirFetch<Bundle>(
    `Patient?_count=${PAGE_SIZE}&_getpagesoffset=${offset}&_total=accurate&_sort=family${filter}`,
  );
  const patients = (bundle?.entry ?? [])
    .flatMap((e) => (e.resource ? [e.resource] : []))
    .filter((r): r is Patient => r.resourceType === "Patient");
  return { patients, total: bundle?.total ?? patients.length };
}

export type PatientDetail = {
  patient: Patient;
  conditions: Condition[];
  allergies: AllergyIntolerance[];
  medications: MedicationRequest[];
  medicationById: Map<string, Medication>;
  immunizations: Immunization[];
  encounters: Encounter[];
};

/** Returns null when the id is malformed or the patient does not exist. */
export async function getPatientDetail(id: string): Promise<PatientDetail | null> {
  // Also stops the id from adding query parameters or path segments.
  if (!isFhirId(id)) return null;
  const patient = await fhirFetch<Patient>(`Patient/${id}`);
  if (!patient) return null;

  const [conditions, allergies, medicationBundle, immunizations, encounters] = await Promise.all([
    fhirSearch<Condition>(`Condition?patient=${id}&_count=100`),
    fhirSearch<AllergyIntolerance>(`AllergyIntolerance?patient=${id}`),
    fhirSearch<MedicationRequest | Medication>(
      `MedicationRequest?patient=${id}&status=active&_include=MedicationRequest:medication&_count=100`,
    ),
    fhirSearch<Immunization>(`Immunization?patient=${id}&_sort=-date&_count=100`),
    fhirSearch<Encounter>(`Encounter?patient=${id}&_sort=-date&_count=100`),
  ]);
  const medications = medicationBundle.filter(
    (r): r is MedicationRequest => r.resourceType === "MedicationRequest",
  );
  const medicationById = new Map(
    medicationBundle.flatMap((r) => (r.resourceType === "Medication" && r.id ? [[r.id, r] as const] : [])),
  );
  return { patient, conditions, allergies, medications, medicationById, immunizations, encounters };
}
