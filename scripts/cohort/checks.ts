import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Bundle, DocumentReference, FhirResource, HumanName } from "fhir/r4";
import { TEST_IDENTIFIERS, isIhi } from "./ids.ts";
import { collectRefs, noteText } from "./lib.ts";

export const MAX_PATIENT_BYTES = 750_000;
export const MAX_COHORT_BYTES = 15_000_000;

const resourcesOf = (file: string) =>
  ((JSON.parse(readFileSync(file, "utf8")) as Bundle).entry ?? []).map((e) => e.resource as FhirResource);

function names(node: unknown, into: HumanName[] = []): HumanName[] {
  if (Array.isArray(node)) node.forEach((n) => names(n, into));
  else if (node && typeof node === "object") {
    const o = node as Record<string, unknown>;
    if (typeof o.family === "string" || Array.isArray(o.given)) into.push(o as HumanName);
    Object.values(o).forEach((v) => names(v, into));
  }
  return into;
}

const AU_CORE_PATIENT = "http://hl7.org.au/fhir/core/StructureDefinition/au-core-patient";

/**
 * Every rule the committed cohort must satisfy. Returns the list of problems (empty = pass).
 * `requireClaims: false` is only for the moment between a rebuild and its validation.
 */
export function checkCohort(dir: string, { requireClaims = true } = {}): string[] {
  const problems: string[] = [];
  const files = readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "manifest.json");
  const patientFiles = files.filter((f) => !f.startsWith("_"));
  if (patientFiles.length !== 20) problems.push(`expected 20 patient bundles, found ${patientFiles.length}`);

  const shared = new Set(resourcesOf(join(dir, "_shared.json")).map((r) => `${r.resourceType}/${r.id}`));
  let total = 0;
  for (const file of files) {
    const raw = readFileSync(join(dir, file), "utf8");
    total += raw.length;
    if (!file.startsWith("_") && raw.length > MAX_PATIENT_BYTES)
      problems.push(`${file}: ${raw.length} bytes`);
    if (/us-core|us-npi|us-ssn/.test(raw)) problems.push(`${file}: contains a US Core / US identifier URL`);

    const resources = resourcesOf(join(dir, file));
    const local = new Set(resources.map((r) => `${r.resourceType}/${r.id}`));
    for (const r of resources) {
      if (r.resourceType === "Claim" || r.resourceType === "ExplanationOfBenefit")
        problems.push(`${file}: ${r.resourceType}`);
      for (const ref of collectRefs(r)) {
        if (!local.has(ref) && !shared.has(ref))
          problems.push(`${file}: dangling reference ${ref} in ${r.resourceType}/${r.id}`);
      }
      if (r.resourceType === "Organization" || r.resourceType === "Practitioner") {
        const pool = r.resourceType === "Organization" ? TEST_IDENTIFIERS.hpio : TEST_IDENTIFIERS.hpii;
        for (const i of r.identifier ?? []) {
          if (!pool.includes(i.value ?? ""))
            problems.push(`${file}: ${i.value} is not a reserved test identifier`);
        }
      }
      for (const n of names(r)) {
        if (/\d/.test([n.family, ...(n.given ?? []), n.text].join(" ")))
          problems.push(`${file}: digit in name ${JSON.stringify(n)}`);
      }
      if (
        r.resourceType === "DocumentReference" &&
        /anthem|hispanic|Patient currently has/i.test(noteText(r as DocumentReference))
      ) {
        problems.push(`${file}: note ${r.id} still mentions race or a US insurer`);
      }
      if (r.resourceType === "Patient") {
        const ihi = r.identifier?.find((i) => i.type?.coding?.[0]?.code === "NI")?.value ?? "";
        if (!isIhi(ihi) || !TEST_IDENTIFIERS.ihi.includes(ihi))
          problems.push(`${file}: IHI is not a reserved test IHI`);
        if (r.identifier?.some((i) => i.system?.includes("medicare")))
          problems.push(`${file}: Medicare numbers have no test range`);
        // A rebuild removes the AU Core claims; cohort:validate must restore them before a commit.
        if (requireClaims && !r.meta?.profile?.includes(AU_CORE_PATIENT)) {
          problems.push(`${file}: Patient does not claim AU Core Patient — run npm run cohort:validate`);
        }
        if (r.address?.[0]?.country !== "AU") problems.push(`${file}: address is not Australian`);
      }
    }
    if (!file.startsWith("_") && resources.filter((r) => r.resourceType === "Patient").length !== 1) {
      problems.push(`${file}: must hold exactly one Patient`);
    }
  }
  if (total > MAX_COHORT_BYTES) problems.push(`cohort is ${total} bytes (limit ${MAX_COHORT_BYTES})`);
  return problems;
}

if (process.argv[1]?.endsWith("checks.ts")) {
  const problems = checkCohort(process.argv[2] ?? "data/cohort");
  problems.slice(0, 40).forEach((p) => console.error(p));
  console.log(problems.length ? `${problems.length} problem(s)` : "cohort checks pass");
  process.exit(problems.length ? 1 : 0);
}
