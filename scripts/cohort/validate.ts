// Validates data/cohort against AU Core with the HL7 validator, and records an AU Core profile in
// meta.profile only on resources that pass it.
// Usage: npm run cohort:validate            (two validator runs: trial, then proof)
//        npm run cohort:validate -- --verify (proof only: committed claims must validate)
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Bundle, FhirResource, OperationOutcome } from "fhir/r4";
import { checkCohort } from "./checks.ts";

const COHORT = "data/cohort";
const WORK = ".cache/validate";
const JAR = ".cache/validator_cli.jar";
const IG = "hl7.fhir.au.core#2.0.0";
// HL7 Australia's terminology server: it holds SNOMED CT-AU and the Australian value sets, which the
// validator's default server (tx.fhir.org) cannot evaluate.
const TX = "https://tx.dev.hl7.org.au/fhir";
const REPORT = "docs/validation/au-core-cohort.md";
const AU_CORE = "http://hl7.org.au/fhir/core/StructureDefinition/au-core-";

const BY_TYPE: Record<string, string> = {
  Patient: "patient",
  Condition: "condition",
  AllergyIntolerance: "allergyintolerance",
  Encounter: "encounter",
  Immunization: "immunization",
  MedicationRequest: "medicationrequest",
  Medication: "medication",
  Procedure: "procedure",
  Organization: "organization",
  Practitioner: "practitioner",
  Location: "location",
};
const VITALS: Record<string, string> = {
  "85354-9": "bloodpressure",
  "8302-2": "bodyheight",
  "29463-7": "bodyweight",
  "8867-4": "heartrate",
  "9279-1": "resprate",
  "8310-5": "bodytemp",
  "72166-2": "smokingstatus",
};

/** The AU Core profile a resource could claim, if any. */
function candidate(r: FhirResource): string | undefined {
  if (r.resourceType === "Observation") {
    const code = r.code.coding?.find((c) => c.system === "http://loinc.org")?.code ?? "";
    if (VITALS[code]) return AU_CORE + VITALS[code];
    const category = r.category?.[0]?.coding?.[0]?.code;
    return category === "laboratory" ? `${AU_CORE}diagnosticresult-path` : undefined;
  }
  return BY_TYPE[r.resourceType] && AU_CORE + BY_TYPE[r.resourceType];
}

const files = () => readdirSync(COHORT).filter((f) => f.endsWith(".json") && f !== "manifest.json");
const read = (dir: string, file: string) => readFileSync(join(dir, file), "utf8").trimEnd().split("\n");

/** Bundles are stored one entry per line, so a claim can be set without reformatting the file. */
function writeWithClaims(
  file: string,
  outDir: string,
  claim: (r: FhirResource, index: number) => string | undefined,
) {
  const lines = read(COHORT, file);
  const out = lines.map((line, i) => {
    if (i === 0 || i === lines.length - 1) return line;
    const entry = JSON.parse(line.replace(/,$/, ""));
    const profile = claim(entry.resource, i - 1);
    const meta = { ...entry.resource.meta, profile: profile ? [profile] : undefined };
    const { resourceType, id, ...rest } = entry.resource;
    delete rest.meta;
    const hasMeta = meta.profile || meta.tag;
    entry.resource = { resourceType, id, ...(hasMeta ? { meta } : {}), ...rest };
    return JSON.stringify(entry) + (line.endsWith(",") ? "," : "");
  });
  writeFileSync(join(outDir, file), out.join("\n") + "\n");
}

type Finding = { index: number; message: string };

/** Runs the validator over a folder and returns the error-level findings per file. */
function validate(dir: string): {
  errors: Map<string, Finding[]>;
  version: string;
  warnings: Map<string, number>;
} {
  if (!existsSync(JAR))
    throw new Error(`Missing ${JAR}. See docs/validation/README.md for the download command.`);
  const errors = new Map<string, Finding[]>();
  const warnings = new Map<string, number>();
  const out = join(WORK, "outcome.json");
  rmSync(out, { force: true });
  const sources = files().map((f) => join(dir, f));
  const run = spawnSync(
    "java",
    ["-Xmx2g", "-jar", JAR, ...sources, "-version", "4.0.1", "-ig", IG, "-tx", TX, "-output", out],
    {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  const version = /FHIR Validation tool Version (\S+)/.exec(run.stdout)?.[1] ?? "unknown";
  if (run.error) throw new Error(`Could not start Java (17+ is required): ${run.error.message}`);
  if (!existsSync(out)) throw new Error(`Validator produced no output:\n${run.stdout.slice(-2000)}`);
  // One OperationOutcome per source file, named by the operationoutcome-file extension.
  const bundle = JSON.parse(readFileSync(out, "utf8")) as Bundle;
  for (const entry of bundle.entry ?? []) {
    const outcome = entry.resource as OperationOutcome;
    const path = outcome.extension?.find((e) => e.url.endsWith("operationoutcome-file"))?.valueString ?? "";
    const file = path.split("/").pop()!;
    const found: Finding[] = [];
    for (const issue of outcome.issue) {
      if (issue.severity === "warning") {
        const text = generalise(issue.details?.text ?? "");
        warnings.set(text, (warnings.get(text) ?? 0) + 1);
      }
      if (issue.severity !== "error" && issue.severity !== "fatal") continue;
      const where = /Bundle\.entry\[(\d+)\]/.exec(issue.expression?.[0] ?? issue.location?.[0] ?? "");
      found.push({
        index: where ? Number(where[1]) : -1,
        message: issue.details?.text ?? issue.diagnostics ?? "",
      });
    }
    errors.set(file, found);
    console.log(`${file}: ${found.length} error(s)`);
  }
  for (const f of files()) if (!errors.has(f)) throw new Error(`Validator returned nothing for ${f}`);
  return { errors, version, warnings };
}

const resources = (file: string) =>
  ((JSON.parse(readFileSync(join(COHORT, file), "utf8")) as Bundle).entry ?? []).map(
    (e) => e.resource as FhirResource,
  );
const generalise = (message: string) =>
  message
    .replace(/'[^']*'/g, "'…'")
    .replace(/\d{4,}/g, "…")
    .slice(0, 160);

rmSync(WORK, { recursive: true, force: true });
mkdirSync(WORK, { recursive: true });
const verifyOnly = process.argv.includes("--verify");
const reasons = new Map<string, Map<string, number>>(); // resource type → message → count

if (!verifyOnly) {
  // Trial: every resource claims its candidate profile; whatever fails loses the claim.
  for (const file of files()) writeWithClaims(file, WORK, (r) => candidate(r));
  const trial = validate(WORK);
  // Guard: a terminology-server outage makes almost everything "fail". Never rewrite the cohort
  // from such a run — every Patient passed before, so a failing Patient means the run is suspect.
  const suspect = files().flatMap((file) => {
    const list = resources(file);
    return trial.errors
      .get(file)!
      .filter((f) => list[f.index]?.resourceType === "Patient" || /^Error from https?:/.test(f.message))
      .map((f) => `${file}: ${f.message.slice(0, 160)}`);
  });
  if (suspect.length) {
    suspect.slice(0, 10).forEach((m) => console.error(m));
    console.error(
      `Trial run is not trustworthy (${suspect.length} Patient or terminology-server errors). Nothing was changed.`,
    );
    process.exit(1);
  }
  for (const file of files()) {
    const found = trial.errors.get(file)!;
    const failed = new Set(found.map((f) => f.index));
    const list = resources(file);
    for (const f of found) {
      const type = list[f.index]?.resourceType ?? "Bundle";
      const perType = reasons.get(type) ?? reasons.set(type, new Map()).get(type)!;
      perType.set(generalise(f.message), (perType.get(generalise(f.message)) ?? 0) + 1);
    }
    writeWithClaims(file, COHORT, (r, index) => (failed.has(index) ? undefined : candidate(r)));
  }
}

// Proof: the cohort as committed must validate with no errors at all.
const proof = validate(COHORT);
const remaining = [...proof.errors.entries()].flatMap(([file, found]) =>
  found.map((f) => `${file} entry ${f.index}: ${f.message}`),
);

const rows = new Map<string, { total: number; claimed: number }>();
let patientsClaimed = 0;
for (const file of files()) {
  for (const r of resources(file)) {
    const key =
      r.resourceType === "Observation"
        ? `Observation (${candidate(r)?.replace(AU_CORE, "") ?? "no AU Core profile"})`
        : r.resourceType;
    const row = rows.get(key) ?? rows.set(key, { total: 0, claimed: 0 }).get(key)!;
    row.total++;
    if (r.meta?.profile?.length) row.claimed++;
    if (r.resourceType === "Patient" && r.meta?.profile?.length) patientsClaimed++;
  }
}

if (!verifyOnly) {
  const table = [...rows.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([type, { total, claimed }]) =>
        `| ${type} | ${total} | ${claimed} | ${type in BY_TYPE || (type.startsWith("Observation (") && !type.includes("no AU Core")) ? (claimed === total ? "all pass" : `${total - claimed} do not pass`) : "no AU Core profile for this type"} |`,
    )
    .join("\n");
  const why = [...reasons.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([type, messages]) =>
        `### ${type}\n\n` +
        [...messages.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([m, n]) => `- ${n}× ${m}`)
          .join("\n"),
    )
    .join("\n\n");
  mkdirSync("docs/validation", { recursive: true });
  writeFileSync(
    REPORT,
    `# AU Core validation of the cohort

Generated by \`npm run cohort:validate\` on ${new Date().toISOString().slice(0, 10)}. Do not edit by hand.

- Implementation guide: \`${IG}\` (FHIR R4)
- Validator: HL7 FHIR validator ${proof.version}; terminology server ${TX} (HL7 Australia, SNOMED CT-AU)
- Rule: a resource carries an AU Core profile in \`meta.profile\` only if it validates against that
  profile with no errors. Resources that do not pass keep no claim and are listed below with the reason.
- Proof run on the committed files: **${remaining.length} error(s)**.

| Resource | Count | Claiming an AU Core profile | Result |
|---|---|---|---|
${table}

## Resources that did not pass, and why

${why || "Every candidate resource passed."}

## What passing does and does not mean

- Medicines are coded in RxNorm and vaccines in CVX (American code systems, as generated by
  Synthea). AU Core prefers Australian codes (AMT, PBS, AIR) but does not require them, so these
  resources pass; the app labels them as US codes rather than mapping them to invented ones.
- Many AU Core terminology bindings are "extensible" or "preferred". Codes outside those value sets
  are reported as warnings, not errors. The most frequent warnings in the proof run:

${[...proof.warnings.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 8)
  .map(([m, n]) => `  - ${n}× ${m}`)
  .join("\n")}
- The data is synthetic and not clinically coherent in places (for example creatinine values that
  do not match the reported eGFR). Validation checks structure and coding, not clinical sense.
`,
  );
  console.log(`Report written to ${REPORT}`);
}

const problems = checkCohort(COHORT);
problems.slice(0, 20).forEach((p) => console.error(p));
remaining.slice(0, 20).forEach((p) => console.error(p));
console.log(
  `Patients claiming AU Core Patient: ${patientsClaimed}/20; errors in proof run: ${remaining.length}`,
);
if (remaining.length || problems.length || patientsClaimed !== 20) process.exit(1);
