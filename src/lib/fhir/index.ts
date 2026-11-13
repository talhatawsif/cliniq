import type {
  AllergyIntolerance,
  Bundle,
  Condition,
  Encounter,
  Immunization,
  Medication,
  MedicationRequest,
  Observation,
  Patient,
} from "fhir/r4";
import { cache } from "react";
import { fhirFetch, fhirSearch, isFhirId } from "./client";
import { IHI_SYSTEM } from "./clinical";

export { FhirError } from "./client";
export * from "./analytes";
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

// Cached per request so the layout and the page share one read.
export const getPatient = cache(async (id: string): Promise<Patient | null> => {
  // Also stops the id from adding query parameters or path segments.
  return isFhirId(id) ? fhirFetch<Patient>(`Patient/${id}`) : null;
});
export const getConditions = cache((id: string) =>
  fhirSearch<Condition>(`Condition?patient=${id}&_count=100`),
);
export const getAllergies = cache((id: string) =>
  fhirSearch<AllergyIntolerance>(`AllergyIntolerance?patient=${id}`),
);

/** Every observation in a category, all pages. */
export const getObservations = cache((id: string, category: "laboratory" | "vital-signs") =>
  fhirSearch<Observation>(`Observation?patient=${id}&category=${category}&_sort=-date&_count=200`),
);

export async function getChartData(id: string) {
  const [medicationBundle, immunizations, encounters] = await Promise.all([
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
  return { medications, medicationById, immunizations, encounters };
}
