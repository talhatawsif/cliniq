import type { AllergyIntolerance, Condition, Medication, MedicationRequest, Patient } from "fhir/r4";
import { ageInYears, codeableText, formatDate, humanName } from "./display";

export const IHI_SYSTEM = "http://ns.electronichealth.net.au/id/hi/ihi/1.0";
const SNOMED_NO_KNOWN_ALLERGY = ["716186003", "409137002"]; // no known allergy; no known drug allergy

/** IHI as four groups of four digits; null when the value is not 16 digits. */
export function formatIhi(value: string | undefined): string | null {
  const digits = value?.replace(/\s/g, "");
  return digits && /^\d{16}$/.test(digits) ? digits.replace(/(\d{4})(?=\d)/g, "$1 ") : null;
}

export type Banner = {
  family: string;
  given: string;
  dob: string;
  /** "56 y", or "Deceased DD/MM/YYYY" */
  status: string;
  deceased: boolean;
  sex: string;
  ihi: string | null;
};

export function banner(p: Patient, now: Date = new Date()): Banner {
  const name = p.name?.find((n) => n.use === "official") ?? p.name?.[0];
  const deceasedOn = p.deceasedDateTime;
  const deceased = Boolean(deceasedOn) || p.deceasedBoolean === true;
  const age = ageInYears(p.birthDate, deceasedOn ?? now);
  return {
    family: (name?.family ?? humanName(p.name)).toUpperCase(),
    given: (name?.given ?? []).join(" "),
    dob: formatDate(p.birthDate),
    status: deceased
      ? `Deceased ${deceasedOn ? formatDate(deceasedOn) : ""}`.trim()
      : age === undefined
        ? "—"
        : `${age} y`,
    deceased,
    sex: p.gender ?? "not recorded",
    ihi: formatIhi(p.identifier?.find((i) => i.system === IHI_SYSTEM)?.value),
  };
}

const code = (c: Condition["clinicalStatus"]) => c?.coding?.[0]?.code;

/** Problem list: refuted and entered-in-error are dropped; active first, then the rest. */
export function problemList(conditions: Condition[]) {
  const shown = conditions.filter(
    (c) => !["refuted", "entered-in-error"].includes(code(c.verificationStatus) ?? ""),
  );
  const active = (c: Condition) => ["active", "recurrence", "relapse"].includes(code(c.clinicalStatus) ?? "");
  return { active: shown.filter(active), inactive: shown.filter((c) => !active(c)) };
}

/** "none-recorded" (nothing on file) is not the same as "no-known" (an explicit statement). */
export function allergyStatus(allergies: AllergyIntolerance[]): "none-recorded" | "no-known" | "listed" {
  const real = allergies.filter((a) => a.verificationStatus?.coding?.[0]?.code !== "entered-in-error");
  if (real.length === 0) return "none-recorded";
  const noKnown = (a: AllergyIntolerance) =>
    a.code?.coding?.some((c) => SNOMED_NO_KNOWN_ALLERGY.includes(c.code ?? ""));
  return real.every(noKnown) ? "no-known" : "listed";
}

const UNITS: Record<string, string> = {
  mg: "mg",
  mcg: "microgram",
  g: "g",
  ml: "mL",
  l: "L",
  iu: "IU",
  unt: "unit",
};

/** ACSQHC style: `5.0 MG` → `5 mg`, `.5mg` → `0.5 mg`; ingredient words in lower case. */
export function medicineText(text: string): string {
  return text
    .replace(/(\d*\.?\d+)\s*(MG|mg|MCG|mcg|G|g|ML|mL|L|IU|UNT)\b/g, (_m, n: string, u: string) => {
      const num = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 6, useGrouping: false }).format(
        Number(n),
      );
      return `${num} ${UNITS[u.toLowerCase()] ?? u}`;
    })
    .replace(/\/(MG|ML|G|L)\b/g, (_m, u: string) => `/${UNITS[u.toLowerCase()]}`)
    .replace(/\b[A-Za-z][a-z]+\b/g, (w) => w.toLowerCase());
}

/** Active medication name; `byId` supplies Medication resources for medicationReference. */
export function medicationName(mr: MedicationRequest, byId: Map<string, Medication>): string {
  const concept =
    mr.medicationCodeableConcept ?? byId.get(mr.medicationReference?.reference?.split("/")[1] ?? "")?.code;
  return medicineText(codeableText(concept, "Unnamed medicine"));
}
