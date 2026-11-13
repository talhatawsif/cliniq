// Builds data/cohort/ from the raw Synthea output: select → trim → Australianise → check.
// Usage: npm run cohort:build   (source folder: SYNTHEA_DIR, default ~/synthea/output/fhir)
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type {
  Bundle,
  DocumentReference,
  FhirResource,
  Location,
  Organization,
  Patient,
  Practitioner,
} from "fhir/r4";
import { ageInYears } from "../../src/lib/fhir/display.ts";
import { MAX_PATIENT_BYTES, checkCohort } from "./checks.ts";
import {
  CLINIQ,
  REFERENCE_DATE,
  type Resolved,
  australianisePatient,
  australianiseResource,
  australianiseShared,
  collectRefs,
  fullName,
  keepsUsUnits,
  rewriteRefs,
  trim,
} from "./lib.ts";
import { type Criterion, SELECTION } from "./selection.ts";

const SOURCE = process.env.SYNTHEA_DIR ?? join(homedir(), "synthea/output/fhir");
const OUT = "data/cohort";
const NOTES = "data/sample-notes";
// Room for the AU Core profile claims the validation step adds to each resource.
const BUILD_LIMIT = MAX_PATIENT_BYTES - 60_000;

const readBundle = (file: string) =>
  ((JSON.parse(readFileSync(file, "utf8")) as Bundle).entry ?? []).map((e) => e.resource as FhirResource);

const toBundle = (resources: FhirResource[]) =>
  '{"resourceType":"Bundle","type":"transaction","entry":[\n' +
  resources
    .map((r) =>
      JSON.stringify({
        fullUrl: `${CLINIQ}/${r.resourceType}/${r.id}`,
        resource: r,
        request: { method: "PUT", url: `${r.resourceType}/${r.id}` },
      }),
    )
    .join(",\n") +
  "\n]}\n";

// ----- source -----
const sourceFiles = readdirSync(SOURCE).filter((f) => f.endsWith(".json"));
type SharedResource = Organization | Practitioner | Location;
const sharedSource = sourceFiles
  .filter((f) => /^(hospital|practitioner)Information/.test(f))
  .flatMap((f) => readBundle(join(SOURCE, f)))
  .filter((r): r is SharedResource => ["Organization", "Practitioner", "Location"].includes(r.resourceType));
// Synthea refers to these by search, e.g. "Practitioner?identifier=system|value".
const sharedByQuery = new Map<string, SharedResource>();
for (const r of sharedSource) {
  for (const i of r.identifier ?? [])
    sharedByQuery.set(`${r.resourceType}?identifier=${i.system}|${i.value}`, r);
}

// ----- criteria -----
const ACTIVE = (r: FhirResource) =>
  r.resourceType === "Condition" && r.clinicalStatus?.coding?.[0]?.code === "active";
const hasCondition = (rs: FhirResource[], codes: string[]) =>
  rs.some(
    (r) =>
      ACTIVE(r) &&
      r.resourceType === "Condition" &&
      r.code?.coding?.some((c) => codes.includes(c.code ?? "")),
  );
const age = (p: Patient) => ageInYears(p.birthDate, p.deceasedDateTime ?? REFERENCE_DATE) ?? -1;
const CHECKS: Record<Criterion, (p: Patient, rs: FhirResource[]) => boolean> = {
  ckd: (_, rs) =>
    hasCondition(rs, [
      "431855005",
      "431856006",
      "433144002",
      "431857002",
      "46177005",
      "127013003",
      "90781000119102",
    ]),
  hypertension: (_, rs) => hasCondition(rs, ["59621000", "38341003"]),
  diabetes: (_, rs) => hasCondition(rs, ["44054006"]),
  lipids: (_, rs) => hasCondition(rs, ["55822004", "302870006", "237602007"]),
  polypharmacy: (_, rs) =>
    rs.filter((r) => r.resourceType === "MedicationRequest" && r.status === "active").length >= 8,
  "older-woman": (p) => p.gender === "female" && age(p) >= 70 && !p.deceasedDateTime,
  allergies: (_, rs) => rs.filter((r) => r.resourceType === "AllergyIntolerance").length >= 3,
  "under-25": (p) => age(p) < 25,
  child: (p) => age(p) < 18,
  deceased: (p) => Boolean(p.deceasedDateTime),
  variety: () => true,
};

// ----- sample notes (hand-written; see data/sample-notes/index.json) -----
type SampleNote = {
  file: string;
  patient: string;
  date: string;
  type: "discharge" | "referral" | "consult";
  title: string;
};
const NOTE_TYPES = {
  discharge: { code: "18842-5", display: "Discharge Summary" },
  referral: { code: "57133-1", display: "Referral Note" },
  consult: { code: "11488-4", display: "Consult Note" },
};
const sampleNotes: SampleNote[] = existsSync(join(NOTES, "index.json"))
  ? JSON.parse(readFileSync(join(NOTES, "index.json"), "utf8"))
  : [];

/** UTC offset in Sydney on a given day ("+10:00" or "+11:00" in daylight saving time). */
function sydneyOffset(day: string): string {
  const name = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", timeZoneName: "longOffset" })
    .formatToParts(new Date(`${day}T00:00:00Z`))
    .find((p) => p.type === "timeZoneName")!.value;
  return name.replace("GMT", "");
}

function sampleNoteResource(note: SampleNote, patient: Patient): DocumentReference {
  const type = NOTE_TYPES[note.type];
  return {
    resourceType: "DocumentReference",
    id: `sample-${note.file.replace(/\.txt$/, "")}`,
    meta: {
      tag: [
        { system: `${CLINIQ}/CodeSystem/tags`, code: "sample-note", display: "Hand-written sample note" },
      ],
    },
    status: "current",
    type: { coding: [{ system: "http://loinc.org", ...type }], text: type.display },
    subject: { reference: `Patient/${patient.id}`, display: fullName(patient.name?.[0]) },
    date: `${note.date}T09:00:00${sydneyOffset(note.date)}`,
    description: note.title,
    content: [
      {
        attachment: {
          contentType: "text/plain; charset=utf-8",
          data: readFileSync(join(NOTES, note.file)).toString("base64"),
          title: note.title,
        },
      },
    ],
  };
}

// ----- build -----
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const sharedUsed = new Set<SharedResource>();
// Rename only the organisations the cohort can refer to (5-year window), so names rarely clash.
const referenced = new Set<SharedResource>();
for (const { id } of SELECTION) {
  const source = readBundle(
    join(
      SOURCE,
      sourceFiles.find((f) => f.includes(`_${id}`))!,
    ),
  );
  const patient = source.find((r): r is Patient => r.resourceType === "Patient")!;
  for (const r of trim(source, 5, patient.deceasedDateTime?.slice(0, 10) ?? REFERENCE_DATE)) {
    for (const ref of collectRefs(r)) {
      const shared = sharedByQuery.get(ref);
      if (shared) referenced.add(shared);
    }
  }
}
for (const r of [...referenced]) {
  const orgId = r.resourceType === "Location" ? r.managingOrganization?.identifier?.value : undefined;
  const org = sharedSource.find((o) => o.resourceType === "Organization" && o.id === orgId);
  if (org) referenced.add(org);
}
const sharedAu = new Map(australianiseShared([...referenced]).map((r) => [r.id!, r]));
const sharedName = (r: SharedResource) => {
  const au = sharedAu.get(r.id!)!;
  return au.resourceType === "Practitioner" ? fullName(au.name?.[0]) : au.name;
};

const manifest = SELECTION.map(({ id, criteria }, index) => {
  const file = sourceFiles.find((f) => f.includes(`_${id}`));
  if (!file) throw new Error(`No source file for ${id}`);
  const source = readBundle(join(SOURCE, file));
  const sourcePatient = source.find((r): r is Patient => r.resourceType === "Patient")!;
  for (const c of criteria) {
    if (!CHECKS[c](sourcePatient, source)) throw new Error(`${file}: does not meet "${c}"`);
  }

  const patient = australianisePatient(sourcePatient, index);
  const patientName = fullName(patient.name?.find((n) => n.use === "official") ?? patient.name?.[0]);
  const referenceDate = sourcePatient.deceasedDateTime?.slice(0, 10) ?? REFERENCE_DATE;
  const notes = sampleNotes
    .filter((n) => id.startsWith(n.patient))
    .map((n) => sampleNoteResource(n, patient));

  // Shorten the history window until the bundle fits the size budget.
  for (const years of [5, 4, 3, 2, 1]) {
    const kept = trim(source, years, referenceDate);
    const ids = new Map(kept.map((r) => [`urn:uuid:${r.id}`, r]));
    const used: SharedResource[] = [];
    const resolve = (ref: string): Resolved | undefined => {
      const local = ids.get(ref);
      if (local) {
        return {
          reference: `${local.resourceType}/${local.id}`,
          display: local === sourcePatient ? patientName : undefined,
        };
      }
      const shared = sharedByQuery.get(ref);
      if (!shared) return undefined;
      used.push(shared);
      return { reference: `${shared.resourceType}/${shared.id}`, display: sharedName(shared) };
    };
    const resources = [
      ...kept.map((r) =>
        rewriteRefs(r === sourcePatient ? patient : australianiseResource(r, () => keepsUsUnits(r)), resolve),
      ),
      ...notes,
    ];
    const json = toBundle(resources);
    if (json.length > BUILD_LIMIT && years > 1) continue;
    if (json.length > BUILD_LIMIT)
      throw new Error(`${file}: ${json.length} bytes even with 1 year of history`);

    used.forEach((r) => sharedUsed.add(r));
    const name = patient.name?.[0];
    const slug = `${name?.family}-${name?.given?.[0]}`
      .normalize("NFD")
      .replace(/[^A-Za-z-]/g, "")
      .toLowerCase();
    writeFileSync(join(OUT, `${slug}.json`), json);
    const count = (type: string) => resources.filter((r) => r.resourceType === type).length;
    return {
      id: patient.id,
      file: `${slug}.json`,
      criteria,
      historyYears: years,
      bytes: json.length,
      resources: resources.length,
      notes: count("DocumentReference"),
      observations: count("Observation"),
    };
  }
  throw new Error("unreachable");
});

// Shared resources: only the ones a cohort patient refers to, plus the organisation behind each location.
const sharedOut = [...sharedUsed].map((r) => sharedAu.get(r.id!)!);
for (const r of [...sharedOut]) {
  const orgId = r.resourceType === "Location" ? r.managingOrganization?.reference?.split("/")[1] : undefined;
  const org = orgId ? sharedAu.get(orgId) : undefined;
  if (org && !sharedOut.includes(org)) sharedOut.push(org);
}
sharedOut.sort((a, b) => `${a.resourceType}/${a.id}`.localeCompare(`${b.resourceType}/${b.id}`));
writeFileSync(join(OUT, "_shared.json"), toBundle(sharedOut));
writeFileSync(
  join(OUT, "manifest.json"),
  JSON.stringify(
    {
      source: "Synthea (Apache 2.0), Australianised; all data synthetic",
      referenceDate: REFERENCE_DATE,
      patients: manifest,
    },
    null,
    2,
  ) + "\n",
);

const problems = checkCohort(OUT);
problems.slice(0, 40).forEach((p) => console.error(p));
const total = manifest.reduce((sum, m) => sum + m.bytes, 0);
console.log(
  `${manifest.length} patients, ${sharedOut.length} shared resources, ${(total / 1e6).toFixed(1)} MB`,
);
console.table(
  manifest.map(({ file, historyYears, bytes, resources, notes }) => ({
    file,
    historyYears,
    kB: Math.round(bytes / 1000),
    resources,
    notes,
  })),
);
if (problems.length) {
  console.error(`${problems.length} problem(s)`);
  process.exit(1);
}
console.log("cohort checks pass");
