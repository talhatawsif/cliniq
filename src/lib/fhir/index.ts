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
// Every getter below checks the id first: it comes from the URL, and an unchecked one could add search parameters.
const none = async <T>(): Promise<T[]> => [];
export const getConditions = cache((id: string) =>
  isFhirId(id) ? fhirSearch<Condition>(`Condition?patient=${id}&_count=100`) : none<Condition>(),
);
export const getAllergies = cache((id: string) =>
  isFhirId(id)
    ? fhirSearch<AllergyIntolerance>(`AllergyIntolerance?patient=${id}`)
    : none<AllergyIntolerance>(),
);

/** Every observation in a category, all pages. */
export const getObservations = cache((id: string, category: "laboratory" | "vital-signs") =>
  isFhirId(id)
    ? fhirSearch<Observation>(`Observation?patient=${id}&category=${category}&_sort=-date&_count=200`)
    : none<Observation>(),
);

export async function getChartData(id: string) {
  if (!isFhirId(id))
    return {
      medications: [],
      medicationById: new Map<string, Medication>(),
      immunizations: [],
      encounters: [],
    };
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

/** Worklist extras for one page of patients: active problem count and last encounter date. */
export async function getWorklistExtras(ids: string[]) {
  const safe = ids.filter(isFhirId);
  const extras = new Map<string, { active: number; lastEncounter?: string }>(
    safe.map((id) => [id, { active: 0 }]),
  );
  if (!safe.length) return extras;
  const [conditions, encounters] = await Promise.all([
    fhirSearch<Condition>(
      `Condition?patient=${safe.join(",")}&clinical-status=active&_elements=subject&_count=500`,
    ),
    Promise.all(
      safe.map((id) =>
        fhirSearch<Encounter>(`Encounter?patient=${id}&_sort=-date&_count=1&_elements=period`, {
          maxPages: 1,
        }),
      ),
    ),
  ]);
  for (const c of conditions) {
    const e = extras.get(c.subject?.reference?.split("/")[1] ?? "");
    if (e) e.active += 1;
  }
  safe.forEach((id, i) => {
    extras.get(id)!.lastEncounter = encounters[i][0]?.period?.start;
  });
  return extras;
}
