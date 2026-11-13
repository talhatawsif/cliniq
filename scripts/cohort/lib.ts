import type {
  Address,
  DocumentReference,
  FhirResource,
  HumanName,
  Location,
  Organization,
  Patient,
  Practitioner,
} from "fhir/r4";
import { makeHpii, makeHpio, makeIhi, makeMedicare } from "./ids.ts";
import { convertToSi } from "./units.ts";

export const REFERENCE_DATE = "2026-11-13";
// Base for ClinIQ's own code systems and bundle URLs (the validator rejects example.org in data).
export const CLINIQ = "https://github.com/talhatawsif/cliniq/fhir";
const V2_0203 = "http://terminology.hl7.org/CodeSystem/v2-0203";

// ---------- deterministic randomness ----------

function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** Seeded generator (mulberry32): the same seed always gives the same cohort. */
export function rng(seed: string): () => number {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T>(rand: () => number, list: T[]) => list[Math.floor(rand() * list.length)];

// ---------- Australian places ----------

const PLACES = [
  ["Parramatta", "NSW", "2150"], ["Newtown", "NSW", "2042"], ["Wollongong", "NSW", "2500"],
  ["Newcastle", "NSW", "2300"], ["Penrith", "NSW", "2750"], ["Albury", "NSW", "2640"],
  ["Dubbo", "NSW", "2830"], ["Tamworth", "NSW", "2340"], ["Footscray", "VIC", "3011"],
  ["Geelong", "VIC", "3220"], ["Ballarat", "VIC", "3350"], ["Bendigo", "VIC", "3550"],
  ["Frankston", "VIC", "3199"], ["Shepparton", "VIC", "3630"], ["Toowoomba", "QLD", "4350"],
  ["Cairns", "QLD", "4870"], ["Townsville", "QLD", "4810"], ["Mackay", "QLD", "4740"],
  ["Rockhampton", "QLD", "4700"], ["Fremantle", "WA", "6160"], ["Bunbury", "WA", "6230"],
  ["Joondalup", "WA", "6027"], ["Glenelg", "SA", "5045"], ["Mount Gambier", "SA", "5290"],
  ["Launceston", "TAS", "7250"], ["Hobart", "TAS", "7000"], ["Belconnen", "ACT", "2617"],
  ["Darwin", "NT", "0800"], ["Alice Springs", "NT", "0870"],
]; // prettier-ignore
const AREA_CODE: Record<string, string> = {
  NSW: "02",
  ACT: "02",
  VIC: "03",
  TAS: "03",
  QLD: "07",
  WA: "08",
  SA: "08",
  NT: "08",
};
const STREETS = [
  "Wattle St",
  "Banksia Ave",
  "Station Rd",
  "Church St",
  "Victoria Pde",
  "Kookaburra Cres",
  "High St",
  "Railway Tce",
];
const ORG_KINDS = ["Medical Centre", "Family Practice", "Health Clinic", "Community Health Centre"];
// Numbers set aside by the ACMA for use in fiction (0491 57x xxx range).
const PHONES = [
  "0491 570 006",
  "0491 570 156",
  "0491 570 157",
  "0491 570 158",
  "0491 570 159",
  "0491 570 110",
  "0491 570 313",
  "0491 570 737",
  "0491 571 266",
  "0491 571 491",
  "0491 571 804",
  "0491 572 549",
  "0491 572 665",
  "0491 572 983",
  "0491 573 770",
  "0491 573 087",
  "0491 574 118",
  "0491 574 632",
  "0491 575 254",
  "0491 575 789",
];

function auAddress(rand: () => number, place = pick(rand, PLACES)): Address {
  const [city, state, postalCode] = place;
  return {
    line: [`${1 + Math.floor(rand() * 180)} ${pick(rand, STREETS)}`],
    city,
    state,
    postalCode,
    country: "AU",
  };
}

// ---------- small helpers ----------

export const stripDigits = (text: string) => text.replace(/\d+/g, "");

const cleanName = (n: HumanName): HumanName => ({
  ...n,
  family: n.family && stripDigits(n.family),
  given: n.given?.map(stripDigits),
  text: undefined,
});

export const fullName = (n: HumanName | undefined) =>
  [...(n?.prefix ?? []), ...(n?.given ?? []), n?.family].filter(Boolean).join(" ");

/** Removes US profile claims and generated narrative from any resource. */
function stripMeta<T extends FhirResource>(r: T): T {
  const copy = { ...r };
  delete copy.meta;
  if ("text" in copy) delete copy.text;
  return copy;
}

const identifier = (code: string, system: string, value: string, typeSystem = V2_0203) => ({
  type: { coding: [{ system: typeSystem, code }] },
  system,
  value,
});

// ---------- Australianise ----------

export function australianisePatient(source: Patient, phoneIndex: number): Patient {
  const rand = rng(source.id!);
  const p = stripMeta(source);
  p.extension = [
    {
      // Never invent a status: every synthetic patient is "not stated".
      url: "http://hl7.org.au/fhir/StructureDefinition/indigenous-status",
      valueCoding: {
        system: "https://healthterminologies.gov.au/fhir/CodeSystem/australian-indigenous-status-1",
        code: "9",
        display: "Not stated/inadequately described",
      },
    },
  ];
  p.identifier = [
    identifier("NI", "http://ns.electronichealth.net.au/id/hi/ihi/1.0", makeIhi(rand)),
    identifier("MC", "http://ns.electronichealth.net.au/id/medicare-number", makeMedicare(rand)),
  ];
  p.name = p.name?.map(cleanName);
  p.telecom = [{ system: "phone", value: PHONES[phoneIndex % PHONES.length], use: "mobile" }];
  p.address = [auAddress(rand)];
  p.communication = p.communication?.map((c) =>
    c.language.coding?.[0]?.code === "en-US"
      ? { language: { coding: [{ system: "urn:ietf:bcp:47", code: "en-AU" }], text: "English" } }
      : c,
  );
  return p;
}

/** Removes race, the US insurer line and digit-suffixed names from a Synthea note. */
export function scrubNote(text: string): string {
  return text
    .replace(/(\d+) (year|month)-old [a-z -]+? (male|female)/g, "$1 $2-old $3")
    .replace(/^.*Patient currently has .*$\n?/gm, "")
    .replace(/\b([A-Z][A-Za-zÀ-ÿ'’]+)\d+\b/g, "$1");
}

const b64 = {
  decode: (data: string) => Buffer.from(data, "base64").toString("utf8"),
  encode: (text: string) => Buffer.from(text, "utf8").toString("base64"),
};
export const noteText = (doc: DocumentReference) => b64.decode(doc.content[0].attachment.data ?? "");

const LOINC = "http://loinc.org";
const SNOMED = "http://snomed.info/sct";
// LOINC code → the SNOMED CT code fixed by the matching AU Core profile (displays from SNOMED CT-AU).
const VITAL_SNOMED: Record<string, [string, string]> = {
  "85354-9": ["75367002", "Blood pressure"],
  "8480-6": ["271649006", "Systolic blood pressure"],
  "8462-4": ["271650006", "Diastolic blood pressure"],
  "8302-2": ["50373000", "Body height measure"],
  "29463-7": ["27113001", "Body weight"],
  "8867-4": ["364075005", "Heart rate"],
  "9279-1": ["86290005", "Respiratory rate"],
  "8310-5": ["386725007", "Body temperature"],
  "72166-2": ["1747861000168109", "Smoking status"],
};

// LOINC displays the validator rejects in the Synthea output, with the official display.
const LOINC_DISPLAY: Record<string, string> = {
  "8302-2": "Body height",
  "29463-7": "Body weight",
  "8480-6": "Systolic blood pressure",
  "8462-4": "Diastolic blood pressure",
};
// Terminology servers disagree on the display for this code, so it carries none (text is kept).
const LOINC_NO_DISPLAY = new Set(["57905-2"]);

/** Australianises one clinical resource (not the Patient). `keepUsUnits` leaves a result unconverted. */
export function australianiseResource(
  source: FhirResource,
  keepUsUnits: (id: string) => boolean,
): FhirResource {
  const r = stripMeta(source);
  if (r.resourceType === "Observation") {
    r.code = structuredClone(r.code);
    r.component = structuredClone(r.component);
    for (const concept of [r.code, ...(r.component ?? []).map((c) => c.code)]) {
      for (const coding of concept.coding ?? []) {
        // Synthea files a few SNOMED codes under LOINC; every LOINC code has a hyphen.
        if (coding.system === LOINC && coding.code && !coding.code.includes("-")) coding.system = SNOMED;
        if (coding.system === LOINC && LOINC_DISPLAY[coding.code ?? ""])
          coding.display = LOINC_DISPLAY[coding.code!];
        if (coding.system === LOINC && LOINC_NO_DISPLAY.has(coding.code ?? "")) delete coding.display;
      }
      // AU Core vital-sign profiles require the SNOMED CT code next to the LOINC code.
      const snomed = concept.coding
        ?.map((c) => (c.system === LOINC ? VITAL_SNOMED[c.code ?? ""] : undefined))
        .find(Boolean);
      if (snomed) concept.coding!.push({ system: SNOMED, code: snomed[0], display: snomed[1] });
    }
    if (!keepUsUnits(r.id!)) convertToSi(r);
  }
  if (r.resourceType === "DocumentReference") {
    delete r.category; // US Core category code system
    r.content = r.content.map((c) => ({
      ...c,
      attachment: { ...c.attachment, data: b64.encode(scrubNote(b64.decode(c.attachment.data ?? ""))) },
    }));
  }
  return r;
}

/** ~10 % of creatinine results stay in mg/dL on purpose, so mixed-unit trending is exercised. */
export const keepsUsUnits = (r: FhirResource) =>
  r.resourceType === "Observation" &&
  r.code.coding?.some((c) => c.code === "2160-0" || c.code === "38483-4") === true &&
  hash(r.id!) % 10 === 0;

type Shared = Organization | Practitioner | Location;

/** Australianises organisations, practitioners and locations. Names are unique per organisation. */
export function australianiseShared(resources: Shared[]): Shared[] {
  const usedNames = new Set<string>();
  const orgs = new Map<string, Organization>();
  const out: Shared[] = [];
  const sorted = [...resources].sort((a, b) => a.id!.localeCompare(b.id!));

  for (const source of sorted.filter((r) => r.resourceType === "Organization")) {
    const rand = rng(source.id!);
    const o = stripMeta(source);
    delete o.extension;
    const kind = /hospital/i.test(o.name ?? "") ? "Hospital" : pick(rand, ORG_KINDS);
    // On a name clash move to the next town, so names stay natural ("Geelong Hospital").
    let at = Math.floor(rand() * PLACES.length);
    for (let tries = 0; usedNames.has(`${PLACES[at][0]} ${kind}`) && tries < PLACES.length; tries++) {
      at = (at + 1) % PLACES.length;
    }
    const address = auAddress(rand, PLACES[at]);
    let name = `${address.city} ${kind}`;
    for (let n = 2; usedNames.has(name); n++) name = `${address.city} ${kind} ${n}`;
    usedNames.add(name);
    o.name = name;
    o.identifier = [
      identifier(
        "NOI",
        "http://ns.electronichealth.net.au/id/hi/hpio/1.0",
        makeHpio(rand),
        "http://terminology.hl7.org.au/CodeSystem/v2-0203",
      ),
    ];
    o.address = [address];
    o.telecom = [
      { system: "phone", value: `(${AREA_CODE[address.state!]}) 5550 ${1000 + Math.floor(rand() * 9000)}` },
    ];
    orgs.set(o.id!, o);
    out.push(o);
  }

  for (const source of sorted.filter((r) => r.resourceType !== "Organization")) {
    const rand = rng(source.id!);
    const r = stripMeta(source);
    delete r.extension;
    if (r.resourceType === "Practitioner") {
      r.name = r.name?.map(cleanName);
      r.identifier = [identifier("NPI", "http://ns.electronichealth.net.au/id/hi/hpii/1.0", makeHpii(rand))];
      r.address = [auAddress(rand)];
      const n = r.name?.[0];
      r.telecom = [
        { system: "email", value: `${n?.given?.[0]}.${n?.family}@example.com`.toLowerCase(), use: "work" },
      ];
    } else {
      const orgId = r.managingOrganization?.identifier?.value;
      const org = orgId ? orgs.get(orgId) : undefined;
      r.name = org?.name ?? `${auAddress(rand).city} Clinic`;
      r.address = org?.address?.[0] ?? auAddress(rand);
      r.telecom = org?.telecom;
      delete r.position;
      delete r.identifier;
      r.managingOrganization = org ? { reference: `Organization/${org.id}`, display: org.name } : undefined;
    }
    out.push(r);
  }
  return out;
}

// ---------- trim ----------

const KEEP_ALWAYS = new Set(["Patient", "Condition", "AllergyIntolerance", "Immunization"]);
const OBS_CATEGORIES = new Set(["laboratory", "vital-signs", "social-history"]);
const MAX_NOTES = 10;

function resourceDate(r: FhirResource): string | undefined {
  switch (r.resourceType) {
    case "Encounter":
      return r.period?.start;
    case "Observation":
      return r.effectiveDateTime;
    case "DiagnosticReport":
      return r.effectiveDateTime;
    case "DocumentReference":
      return r.date;
    case "Procedure":
      return r.performedPeriod?.start ?? r.performedDateTime;
    case "MedicationRequest":
      return r.authoredOn;
  }
}

/** SNOMED CT US-extension concepts (namespace 1000124) do not exist in SNOMED CT-AU. */
const hasUsOnlySnomedCode = (r: FhirResource) =>
  (r.resourceType === "Procedure" || r.resourceType === "Condition" || r.resourceType === "Observation") &&
  r.code?.coding?.some((c) => c.system === "http://snomed.info/sct" && /1000124\d{3}$/.test(c.code ?? "")) ===
    true;

/** Every reference string inside a resource. */
export function collectRefs(node: unknown, into: string[] = []): string[] {
  if (Array.isArray(node)) node.forEach((n) => collectRefs(n, into));
  else if (node && typeof node === "object") {
    const o = node as Record<string, unknown>;
    if (typeof o.reference === "string") into.push(o.reference);
    Object.values(o).forEach((v) => collectRefs(v, into));
  }
  return into;
}

/**
 * Picks the resources to keep: all problems, allergies and immunisations, active medications, and
 * everything else of the kept types from the last `years` years (10 notes at most). Encounters and
 * Medications that a kept resource points at are kept too.
 */
export function trim(resources: FhirResource[], years: number, referenceDate: string): FhirResource[] {
  const cutoff = `${Number(referenceDate.slice(0, 4)) - years}${referenceDate.slice(4, 10)}`;
  const recent = (r: FhirResource) => (resourceDate(r) ?? "") >= cutoff;

  const keep = new Set<FhirResource>();
  for (const r of resources) {
    if (hasUsOnlySnomedCode(r)) continue;
    if (KEEP_ALWAYS.has(r.resourceType)) keep.add(r);
    else if (r.resourceType === "MedicationRequest") {
      if (r.status === "active" || recent(r)) keep.add(r);
    } else if (r.resourceType === "Encounter" || r.resourceType === "Procedure") {
      if (recent(r)) keep.add(r);
    } else if (r.resourceType === "Observation") {
      const category = r.category?.[0]?.coding?.[0]?.code;
      if (category && OBS_CATEGORIES.has(category) && recent(r)) keep.add(r);
    } else if (r.resourceType === "DiagnosticReport") {
      if (r.category?.some((c) => c.coding?.some((x) => x.code === "LAB")) && recent(r)) keep.add(r);
    }
  }
  resources
    .filter((r): r is DocumentReference => r.resourceType === "DocumentReference" && recent(r))
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
    .slice(0, MAX_NOTES)
    .forEach((r) => keep.add(r));

  const byUrn = new Map(resources.map((r) => [`urn:uuid:${r.id}`, r]));
  for (const r of [...keep]) {
    for (const ref of collectRefs(r)) {
      const target = byUrn.get(ref);
      if (target && (target.resourceType === "Encounter" || target.resourceType === "Medication"))
        keep.add(target);
    }
  }
  return resources.filter((r) => keep.has(r));
}

// ---------- references ----------

export type Resolved = { reference: string; display?: string };
const PRUNE = Symbol("prune");

/**
 * Rewrites every reference with `resolve`. A reference that cannot be resolved is removed, so the
 * output never points at something that is not in the cohort.
 */
export function rewriteRefs<T>(node: T, resolve: (ref: string) => Resolved | undefined): T {
  const walk = (n: unknown): unknown => {
    if (Array.isArray(n)) return n.map(walk).filter((v) => v !== PRUNE);
    if (n && typeof n === "object") {
      const o = n as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      if (typeof o.reference === "string") {
        const target = resolve(o.reference);
        if (!target) return PRUNE;
        for (const [k, v] of Object.entries(o)) out[k] = walk(v);
        out.reference = target.reference;
        if (target.display) out.display = target.display;
        return out;
      }
      for (const [k, v] of Object.entries(o)) {
        const w = walk(v);
        if (w !== PRUNE) out[k] = w;
      }
      return out;
    }
    return n;
  };
  return walk(node) as T;
}
