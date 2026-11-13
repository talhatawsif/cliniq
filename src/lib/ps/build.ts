// AU Patient Summary (AU PS 1.0.0) document Bundle from a patient's confirmed data. Pure: no I/O, and
// relative .ts imports only, so scripts/ps/validate.ts can run it under Node.
import type {
  AllergyIntolerance,
  Bundle,
  CodeableConcept,
  Composition,
  Condition,
  Immunization,
  Medication,
  MedicationRequest,
  Observation,
  Organization,
  Patient,
  Practitioner,
  Resource,
} from "fhir/r4";

export const BASE = "https://cliniq.example/fhir"; // document-local base so relative references resolve
const PS = "http://hl7.org.au/fhir/ps/StructureDefinition/au-ps-";

export type Source = {
  patient: Patient;
  conditions: Condition[];
  allergies: AllergyIntolerance[];
  medications: MedicationRequest[];
  medicationById: Map<string, Medication>;
  immunizations: Immunization[];
  results: Observation[];
  /** Practitioners the medication requests refer to (AU Core requires a requester). */
  practitioners: Practitioner[];
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const text = (c?: CodeableConcept) =>
  c?.text ?? c?.coding?.find((x) => x.display)?.display ?? c?.coding?.[0]?.code ?? "Unknown";
const verified = (r: { verificationStatus?: CodeableConcept }) =>
  r.verificationStatus?.coding?.[0]?.code === "confirmed";
const active = (r: { clinicalStatus?: CodeableConcept }) => r.clinicalStatus?.coding?.[0]?.code === "active";

/** Latest result per LOINC code, final-ish only. */
function latestResults(all: Observation[]): Observation[] {
  const best = new Map<string, Observation>();
  for (const o of all) {
    if (!["final", "amended", "corrected"].includes(o.status)) continue;
    const key = o.code.coding?.find((c) => c.system === "http://loinc.org")?.code;
    const at = o.effectiveDateTime ?? "";
    if (key && at > (best.get(key)?.effectiveDateTime ?? "")) best.set(key, o);
  }
  return [...best.values()];
}

const when = (d?: string) => (d ? d.slice(0, 10) : "date not recorded");
const resultText = (o: Observation) => {
  const q = o.valueQuantity;
  return q
    ? `${q.value}${q.unit ? ` ${q.unit}` : ""}`
    : (o.valueString ?? o.valueCodeableConcept?.text ?? "");
};

/** Drops every Reference that does not point at a resource in the document (a document must be self-contained). */
function prune<T>(value: T, present: Set<string>): T {
  if (Array.isArray(value)) {
    return value.filter((v) => !(isRef(v) && !present.has(v.reference))).map((v) => prune(v, present)) as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (isRef(v) && !present.has(v.reference)) continue;
      const p = prune(v, present);
      if (Array.isArray(p) && p.length === 0) continue;
      out[k] = p;
    }
    return out as T;
  }
  return value;
}
const isRef = (v: unknown): v is { reference: string } =>
  Boolean(v) && typeof v === "object" && typeof (v as { reference?: unknown }).reference === "string";

const div = (inner: string) => ({
  status: "generated" as const,
  div: `<div xmlns="http://www.w3.org/1999/xhtml">${inner}</div>`,
});
const list = (items: string[]) => `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;

export function buildPatientSummary(src: Source, now = new Date()): Bundle {
  const pid = src.patient.id!;
  const subject = { reference: `Patient/${pid}` };

  const conditions = src.conditions.filter((c) => verified(c) && active(c));
  const allergies = src.allergies.filter((a) => verified(a) && active(a));
  const meds = src.medications.filter((m) => m.status === "active");
  const vaccines = src.immunizations.filter((i) => i.status === "completed");
  const results = latestResults(src.results);

  const medResources: Medication[] = meds.flatMap((m) => {
    const id = m.medicationReference?.reference?.split("/")[1];
    const med = id ? src.medicationById.get(id) : undefined;
    return med ? [med] : [];
  });
  const medNames = (m: MedicationRequest) =>
    text(
      m.medicationCodeableConcept ??
        src.medicationById.get(m.medicationReference?.reference?.split("/")[1] ?? "")?.code,
    );

  // Required sections with nothing to say say so with section.emptyReason (IPS 2.0.1 rule ips-comp-1) rather than
  // being dropped. That IPS version has no "absent/unknown" code system to put in an entry.
  const problemEntries: Resource[] = conditions;
  const allergyEntries: Resource[] = allergies;
  const medEntries: Resource[] = [...meds, ...medResources];

  const section = (
    code: string,
    display: string,
    title: string,
    entries: Resource[],
    narrative: string[],
    emptyNote: string,
  ) => ({
    title,
    code: { coding: [{ system: "http://loinc.org", code, display }] },
    text: div(narrative.length ? list(narrative) : `<p>${esc(emptyNote)}</p>`),
    ...(entries.length
      ? {
          entry: entries
            .filter((e) => e.resourceType !== "Medication")
            .map((e) => ({ reference: `${e.resourceType}/${e.id}` })),
        }
      : {
          emptyReason: {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/list-empty-reason",
                code: "unavailable",
                display: "Unavailable",
              },
            ],
          },
        }),
  });

  // The document is made by this demo app, maintained by its owner: a Practitioner author and, because FHIR
  // only allows an Organization as custodian, an Organization with the same name.
  const author: Practitioner = {
    resourceType: "Practitioner",
    id: "cliniq-author",
    active: true,
    name: [{ family: "Tawsif", given: ["Talha"] }],
  };
  const custodian: Organization = {
    resourceType: "Organization",
    id: "cliniq-custodian",
    active: true,
    name: "Talha Tawsif",
  };
  const sections: Composition["section"] = [
    section(
      "11450-4",
      "Problem list - Reported",
      "Problems",
      problemEntries,
      conditions.map((c) => `${text(c.code)} (onset ${when(c.onsetDateTime ?? c.recordedDate)})`),
      "No information about problems.",
    ),
    section(
      "48765-2",
      "Allergies and adverse reactions Document",
      "Allergies and adverse reactions",
      allergyEntries,
      allergies.map((a) => `${text(a.code)}${a.criticality ? ` (criticality ${a.criticality})` : ""}`),
      "No information about allergies.",
    ),
    section(
      "10160-0",
      "History of Medication use Narrative",
      "Medicines",
      medEntries,
      meds.map(
        (m) => `${medNames(m)}${m.dosageInstruction?.[0]?.text ? `: ${m.dosageInstruction[0].text}` : ""}`,
      ),
      "No information about medicines.",
    ),
  ];
  if (vaccines.length) {
    sections.push(
      section(
        "11369-6",
        "History of Immunization note",
        "Immunisations",
        vaccines,
        vaccines.map((i) => `${text(i.vaccineCode)} (${when(i.occurrenceDateTime)})`),
        "",
      ),
    );
  }
  if (results.length) {
    sections.push(
      section(
        "30954-2",
        "Relevant diagnostic tests/laboratory data note",
        "Results",
        results,
        results.map((o) => `${text(o.code)}: ${resultText(o)} (${when(o.effectiveDateTime)})`),
        "",
      ),
    );
  }

  const composition: Composition = {
    resourceType: "Composition",
    id: `ps-${pid}`,
    meta: { profile: [`${PS}composition`] },
    status: "final",
    type: { coding: [{ system: "http://loinc.org", code: "60591-5", display: "Patient summary Document" }] },
    subject,
    date: now.toISOString(),
    author: [{ reference: "Practitioner/cliniq-author" }],
    title: "Patient Summary",
    custodian: { reference: "Organization/cliniq-custodian" },
    section: sections,
  };

  const patient: Patient = { ...src.patient, meta: { ...src.patient.meta, profile: [`${PS}patient`] } };
  const all: Resource[] = [
    composition,
    patient,
    author,
    ...problemEntries,
    ...allergyEntries,
    ...medEntries,
    ...(meds.length ? src.practitioners : []),
    ...vaccines,
    ...results,
  ];
  const present = new Set(all.map((r) => `${r.resourceType}/${r.id}`));
  return {
    resourceType: "Bundle",
    type: "document",
    identifier: { system: "urn:ietf:rfc:3986", value: `urn:uuid:${crypto.randomUUID()}` },
    timestamp: now.toISOString(),
    entry: all.map((r) => ({ fullUrl: `${BASE}/${r.resourceType}/${r.id}`, resource: prune(r, present) })),
  };
}
