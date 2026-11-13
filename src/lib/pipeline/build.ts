// Builds the FHIR for auto-extracted findings and for review decisions. Pure: no I/O, relative imports only.
import { createHash } from "node:crypto";
import type {
  Bundle,
  BundleEntry,
  Condition,
  Device,
  DocumentReference,
  Practitioner,
  Provenance,
} from "fhir/r4";

export const TAGS = "https://github.com/talhatawsif/cliniq/fhir/CodeSystem/tags";
export const FINDING_ID = "http://cliniq.example/fhir/identifier/auto-finding";
const DEVICE_ID = "http://cliniq.example/fhir/identifier/pipeline-device";
const CLINICIAN_ID = "http://cliniq.example/fhir/identifier/demo-clinician";
const SNOMED = "http://snomed.info/sct";
const VER = "http://terminology.hl7.org/CodeSystem/condition-ver-status";
const CLIN = "http://terminology.hl7.org/CodeSystem/condition-clinical";
const OP = "http://terminology.hl7.org/CodeSystem/v3-DataOperation";
const PART = "http://terminology.hl7.org/CodeSystem/provenance-participant-type";

export const hash = (...parts: string[]) => createHash("sha256").update(parts.join("|")).digest("hex");
const uuid = (seed: string) =>
  hash(seed).replace(/^(.{8})(.{4}).(.{3}).(.{3})(.{12}).*$/, "$1-$2-4$3-8$4-$5");

export type Coding = { code: string; display: string };
export type Finding = {
  patientId: string;
  docId: string;
  text: string; // the note span, as written
  coding: Coding;
};

/** Why an entity is not written, or null when it is affirmed. Only affirmed findings go forward. */
export function reasonNotWritten(e: {
  negated: boolean;
  family: boolean;
  historical: boolean;
  hypothetical: boolean;
  uncertain: boolean;
}): string | null {
  if (e.negated) return "negated";
  if (e.family) return "family history";
  if (e.hypothetical) return "hypothetical";
  if (e.uncertain) return "uncertain";
  if (e.historical) return "historical";
  return null;
}

/** Same note and same code give the same identifier, so a rerun creates nothing new. */
export const findingKey = (docId: string, code: string) => hash(docId, code).slice(0, 32);

/** A pasted note stored as a DocumentReference (id derived from patient and text). */
export function buildNote(patientId: string, text: string, now: Date): DocumentReference {
  return {
    resourceType: "DocumentReference",
    id: `pasted-${hash(patientId, text).slice(0, 24)}`,
    meta: { tag: [{ system: TAGS, code: "pasted-note", display: "Pasted note" }] },
    status: "current",
    type: { coding: [{ system: "http://loinc.org", code: "34109-9", display: "Note" }] },
    subject: { reference: `Patient/${patientId}` },
    date: now.toISOString(),
    description: "Pasted note",
    content: [
      {
        attachment: { contentType: "text/plain; charset=utf-8", data: Buffer.from(text).toString("base64") },
      },
    ],
  };
}

const entry = (
  resource: BundleEntry["resource"],
  request: NonNullable<BundleEntry["request"]>,
  fullUrl?: string,
): BundleEntry => ({ fullUrl, resource, request });

/** One transaction: the unconfirmed Condition (conditional create), its Provenance and the pipeline Device. */
export function buildFinding(f: Finding, tool: { version: string }, now: Date): Bundle {
  const key = findingKey(f.docId, f.coding.code);
  const deviceKey = hash(tool.version).slice(0, 32);
  const conditionUrl = `urn:uuid:${uuid(`condition|${key}`)}`;
  const deviceUrl = `urn:uuid:${uuid(`device|${deviceKey}`)}`;
  const source = { reference: `DocumentReference/${f.docId}` };

  const condition: Condition = {
    resourceType: "Condition",
    meta: { tag: [{ system: TAGS, code: "auto-extracted", display: "Auto-extracted" }] },
    identifier: [{ system: FINDING_ID, value: key }],
    clinicalStatus: { coding: [{ system: CLIN, code: "active" }] },
    verificationStatus: { coding: [{ system: VER, code: "unconfirmed" }] },
    category: [
      {
        coding: [
          { system: "http://terminology.hl7.org/CodeSystem/condition-category", code: "encounter-diagnosis" },
        ],
      },
    ],
    code: { coding: [{ system: SNOMED, code: f.coding.code, display: f.coding.display }], text: f.text },
    subject: { reference: `Patient/${f.patientId}` },
    recordedDate: now.toISOString(),
    evidence: [{ detail: [source] }],
  };
  const provenance: Provenance = {
    resourceType: "Provenance",
    id: `prov-create-${key}`,
    target: [{ reference: conditionUrl }],
    recorded: now.toISOString(),
    activity: { coding: [{ system: OP, code: "CREATE" }] },
    agent: [{ type: { coding: [{ system: PART, code: "assembler" }] }, who: { reference: deviceUrl } }],
    entity: [{ role: "source", what: source }],
  };
  const device: Device = {
    resourceType: "Device",
    identifier: [{ system: DEVICE_ID, value: deviceKey }],
    deviceName: [{ name: "ClinIQ coding pipeline", type: "user-friendly-name" }],
    version: [{ value: tool.version }],
  };
  return {
    resourceType: "Bundle",
    type: "transaction",
    entry: [
      entry(
        device,
        { method: "POST", url: "Device", ifNoneExist: `identifier=${DEVICE_ID}|${deviceKey}` },
        deviceUrl,
      ),
      entry(
        condition,
        { method: "POST", url: "Condition", ifNoneExist: `identifier=${FINDING_ID}|${key}` },
        conditionUrl,
      ),
      entry(
        provenance,
        { method: "PUT", url: `Provenance/${provenance.id}` },
        `urn:uuid:${uuid(`provenance|${key}`)}`,
      ),
    ],
  };
}

export type Decision = "confirm" | "change" | "reject";

/** One transaction for a reviewer's decision: update the Condition and record who verified it. */
export function buildDecision(
  condition: Condition,
  decision: Decision,
  now: Date,
  newCoding?: Coding,
): Bundle {
  if (decision === "change" && !newCoding) throw new Error("A changed code needs the new code");
  const old = condition.code?.coding?.[0];
  const updated: Condition = structuredClone(condition);
  if (decision === "reject") {
    updated.verificationStatus = { coding: [{ system: VER, code: "refuted" }] };
    updated.clinicalStatus = { coding: [{ system: CLIN, code: "inactive" }] };
  } else {
    updated.verificationStatus = { coding: [{ system: VER, code: "confirmed" }] };
  }
  if (decision === "change" && newCoding) {
    updated.code = {
      ...updated.code,
      coding: [{ system: SNOMED, code: newCoding.code, display: newCoding.display }],
    };
  }
  const who = `urn:uuid:${uuid(`clinician|${CLINICIAN_ID}`)}`;
  const reason =
    decision === "change"
      ? `Reviewer changed the code from ${old?.code} ${old?.display} to ${newCoding?.code} ${newCoding?.display}`
      : decision === "reject"
        ? "Reviewer rejected the auto-extracted finding"
        : "Reviewer confirmed the auto-extracted finding";
  const provenance: Provenance = {
    resourceType: "Provenance",
    target: [{ reference: `Condition/${condition.id}` }],
    recorded: now.toISOString(),
    activity: { coding: [{ system: OP, code: "UPDATE" }] },
    reason: [{ text: reason }],
    agent: [{ type: { coding: [{ system: PART, code: "verifier" }] }, who: { reference: who } }],
  };
  const practitioner: Practitioner = {
    resourceType: "Practitioner",
    identifier: [{ system: CLINICIAN_ID, value: "demo-clinician" }],
    name: [{ family: "Clinician", given: ["Demo"] }],
  };
  const version = condition.meta?.versionId;
  return {
    resourceType: "Bundle",
    type: "transaction",
    entry: [
      entry(
        practitioner,
        { method: "POST", url: "Practitioner", ifNoneExist: `identifier=${CLINICIAN_ID}|demo-clinician` },
        who,
      ),
      entry(
        updated,
        { method: "PUT", url: `Condition/${condition.id}`, ...(version && { ifMatch: `W/"${version}"` }) },
        `urn:uuid:${uuid(`condition|${condition.id}`)}`,
      ),
      entry(
        provenance,
        { method: "POST", url: "Provenance" },
        `urn:uuid:${uuid(`decision|${condition.id}|${decision}|${now.toISOString()}`)}`,
      ),
    ],
  };
}
