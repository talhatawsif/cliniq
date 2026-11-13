// Builds the numbered fact list the assistant may use. One patient only: the caller passes that patient's data.
import type {
  AllergyIntolerance,
  Condition,
  DocumentReference,
  Encounter,
  Immunization,
  Medication,
  MedicationRequest,
  Observation,
  Resource,
} from "fhir/r4";
import { flagOf, formatResult, isIncluded, referenceText } from "../fhir/analytes";
import { allergyStatus, medicationName, medicineText } from "../fhir/clinical";
import { codeableText, formatDate } from "../fhir/display";

export type Fact = {
  id: string;
  kind: string;
  text: string;
  resource: Resource | null;
  /** Result facts: a short test name and the code that groups the same test, for lookups. */
  name?: string;
  analyte?: string;
};

export type PatientData = {
  conditions: Condition[];
  allergies: AllergyIntolerance[];
  medications: MedicationRequest[];
  medicationById: Map<string, Medication>;
  immunizations: Immunization[];
  encounters: Encounter[];
  observations: Observation[];
  /** Only supplied when the question is about a note or letter. */
  notes?: DocumentReference[];
};

const code = (c?: { coding?: { code?: string }[] }) => c?.coding?.[0]?.code;
const when = (o: Observation) => o.effectiveDateTime ?? o.effectivePeriod?.start ?? o.issued ?? "";
const NOTE_EXCERPT = 400;

/** "Creatinine [Moles/volume] in Serum or Plasma" -> "Creatinine"; "Blood pressure panel with ..." -> "Blood pressure". */
export const shortName = (name: string) =>
  name.replace(/\s*(\[.*|panel\b.*| in (serum|blood|red|urine|plasma)\b.*)$/i, "").trim();

export const noteText = (d: DocumentReference) =>
  Buffer.from(d.content?.[0]?.attachment?.data ?? "", "base64").toString("utf8");

const owner = (r: Resource): string | undefined => {
  const x = r as { subject?: { reference?: string }; patient?: { reference?: string } };
  return (x.subject ?? x.patient)?.reference;
};

/** Facts for one patient. A resource that belongs to anyone else is dropped, whatever the caller passed in. */
export function buildFacts(patientId: string, all: PatientData): Fact[] {
  const mine = <T extends Resource>(list: T[]) => list.filter((r) => owner(r) === `Patient/${patientId}`);
  const d: PatientData = {
    ...all,
    conditions: mine(all.conditions),
    allergies: mine(all.allergies),
    medications: mine(all.medications),
    immunizations: mine(all.immunizations),
    encounters: mine(all.encounters),
    observations: mine(all.observations),
    notes: mine(all.notes ?? []),
  };
  const out: Omit<Fact, "id">[] = [];
  const add = (kind: string, text: string, resource: Resource | null, name?: string, analyte?: string) =>
    out.push({ kind, text, resource, name, analyte });

  const live = d.conditions.filter(
    (c) => !["refuted", "entered-in-error"].includes(code(c.verificationStatus) ?? ""),
  );
  const isActive = (c: Condition) =>
    ["active", "recurrence", "relapse"].includes(code(c.clinicalStatus) ?? "");
  const conditionText = (c: Condition) =>
    `${codeableText(c.code)} — ${code(c.clinicalStatus) ?? "status not recorded"}, ${code(c.verificationStatus) === "confirmed" ? "confirmed" : "auto-extracted, not confirmed"}${c.onsetDateTime ? `, onset ${formatDate(c.onsetDateTime)}` : ""}`;
  for (const c of live.filter(isActive).slice(0, 25)) add("Condition", `Condition: ${conditionText(c)}`, c);
  // Resolved problems are available to the model but are not "active problems".
  const resolved = live
    .filter((c) => !isActive(c))
    .sort((x, y) => (y.onsetDateTime ?? "").localeCompare(x.onsetDateTime ?? ""));
  for (const c of resolved.slice(0, 5))
    add("Resolved condition", `Resolved condition: ${conditionText(c)}`, c);
  for (const m of d.medications.filter((m) => m.status === "active").slice(0, 25)) {
    const dose = m.dosageInstruction?.[0]?.text;
    add(
      "Medicine",
      `Medicine: ${medicationName(m, d.medicationById)}${dose ? ` — ${medicineText(dose)}` : ""} — active`,
      m,
    );
  }
  const listed = d.allergies.filter((a) => code(a.verificationStatus) !== "entered-in-error");
  if (allergyStatus(d.allergies) === "none-recorded")
    add("Allergy", "Allergy: none recorded for this patient", null);
  for (const a of listed.slice(0, 15)) {
    add(
      "Allergy",
      `Allergy: ${codeableText(a.code)} — ${code(a.clinicalStatus) ?? "status not recorded"}${a.criticality ? `, criticality ${a.criticality}` : ""}`,
      a,
    );
  }

  // Latest two results per analyte.
  const byAnalyte = new Map<string, Observation[]>();
  for (const o of d.observations.filter(isIncluded).sort((a, b) => when(b).localeCompare(when(a)))) {
    const key = o.code?.coding?.[0]?.code ?? codeableText(o.code);
    byAnalyte.set(key, [...(byAnalyte.get(key) ?? []), o]);
  }
  for (const [key, list] of [...byAnalyte.entries()].slice(0, 40)) {
    for (const o of list.slice(0, 2)) {
      const flag = flagOf(o);
      const range = referenceText(o);
      const detail = [flag, range !== "—" ? `range ${range}` : ""].filter(Boolean).join(", ");
      add(
        "Result",
        `Result: ${shortName(codeableText(o.code))} ${formatResult(o)}${detail ? ` (${detail})` : ""} on ${formatDate(when(o))}`,
        o,
        shortName(codeableText(o.code)),
        key,
      );
    }
  }
  for (const e of [...d.encounters]
    .sort((a, b) => (b.period?.start ?? "").localeCompare(a.period?.start ?? ""))
    .slice(0, 5)) {
    const reason = e.reasonCode?.[0] ? `, reason ${codeableText(e.reasonCode[0])}` : "";
    add(
      "Encounter",
      `Encounter: ${codeableText(e.type?.[0], e.class?.display ?? "Encounter")} on ${formatDate(e.period?.start)}${reason}`,
      e,
    );
  }
  for (const i of [...d.immunizations]
    .sort((a, b) => (b.occurrenceDateTime ?? "").localeCompare(a.occurrenceDateTime ?? ""))
    .slice(0, 15)) {
    add(
      "Immunisation",
      `Immunisation: ${codeableText(i.vaccineCode)} on ${formatDate(i.occurrenceDateTime)}`,
      i,
    );
  }
  for (const n of (d.notes ?? []).slice(0, 2)) {
    const text = noteText(n).replace(/\s+/g, " ").trim().slice(0, NOTE_EXCERPT);
    add("Note", `Note excerpt (${formatDate(n.date)}): “${text}”`, n);
  }
  return out.map((f, i) => ({ ...f, id: `F${i + 1}` }));
}

export const factLine = (f: Fact) => `[${f.id}] ${f.text}`;
