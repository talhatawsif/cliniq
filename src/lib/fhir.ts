function baseUrl() {
  const url = process.env.FHIR_BASE_URL;
  if (!url) throw new Error("FHIR_BASE_URL is not set (see .env.example)");
  return url.replace(/\/$/, "");
}

async function getJson(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`FHIR request failed (${res.status}): ${url}`);
  return res.json();
}

// Follows Bundle "next" links so long lists are not cut off at the first page.
async function getAll(url: string) {
  const resources: any[] = [];
  for (let next: string | undefined = url; next; ) {
    const bundle: any = await getJson(next);
    resources.push(...(bundle.entry?.map((e: any) => e.resource) ?? []));
    next = bundle.link?.find((l: any) => l.relation === "next")?.url;
  }
  return resources;
}

export async function getPatients() {
  const bundle = await getJson(`${baseUrl()}/Patient?_count=50`);
  return bundle.entry?.map((e: any) => e.resource) ?? [];
}

// Returns null when the id is malformed or the patient does not exist.
export async function getPatientDetail(id: string) {
  // FHIR id format; also stops the id from adding query parameters or path segments.
  if (!/^[A-Za-z0-9.-]{1,64}$/.test(id)) return null;
  const base = baseUrl();

  const patientRes = await fetch(`${base}/Patient/${id}`, { cache: "no-store" });
  if (patientRes.status === 404 || patientRes.status === 410) return null;
  if (!patientRes.ok) throw new Error(`FHIR request failed (${patientRes.status}): Patient/${id}`);

  const [patient, obsBundle, conditions, allergies] = await Promise.all([
    patientRes.json(),
    getJson(`${base}/Observation?patient=${id}&_sort=-date&_count=20`),
    getAll(`${base}/Condition?patient=${id}&clinical-status=active`),
    getAll(`${base}/AllergyIntolerance?patient=${id}`),
  ]);

  return {
    patient,
    observations: obsBundle.entry?.map((e: any) => e.resource) ?? [],
    conditions,
    allergies,
  };
}
