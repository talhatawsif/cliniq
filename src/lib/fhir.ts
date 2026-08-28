const FHIR_BASE_URL = "http://localhost:8080/fhir";

export async function getPatients() {
  const res = await fetch(`${FHIR_BASE_URL}/Patient?_count=50`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch patients");
  const bundle = await res.json();
  return bundle.entry?.map((e: any) => e.resource) ?? [];
}

export async function getPatientDetail(id: string) {
  const [patientRes, obsRes, condRes, allergyRes] = await Promise.all([
    fetch(`${FHIR_BASE_URL}/Patient/${id}`, { cache: "no-store" }),
    fetch(`${FHIR_BASE_URL}/Observation?patient=${id}&_sort=-date&_count=20`, { cache: "no-store" }),
    fetch(`${FHIR_BASE_URL}/Condition?patient=${id}`, { cache: "no-store" }),
    fetch(`${FHIR_BASE_URL}/AllergyIntolerance?patient=${id}`, { cache: "no-store" }),
  ]);

  const patient = await patientRes.json();
  const obsBundle = await obsRes.json();
  const condBundle = await condRes.json();
  const allergyBundle = await allergyRes.json();

  return {
    patient,
    observations: obsBundle.entry?.map((e: any) => e.resource) ?? [],
    conditions: condBundle.entry?.map((e: any) => e.resource) ?? [],
    allergies: allergyBundle.entry?.map((e: any) => e.resource) ?? [],
  };
}
