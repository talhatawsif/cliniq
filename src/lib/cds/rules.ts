import type { Condition, Observation, Patient } from "fhir/r4";
import { ageInYears } from "@/lib/fhir/display";

export type Card = {
  uuid: string;
  summary: string;
  detail?: string;
  indicator: "info" | "warning" | "critical";
  source: { label: string };
};
export type Inputs = {
  patient: Patient;
  conditions: Condition[];
  creatinine: Observation[];
  weight: Observation[];
  height: Observation[];
  hba1c: Observation[];
  bp: Observation[];
};

const SOURCE = { label: "ClinIQ decision support (demo)" };
const DAY = 86_400_000;
const DIABETES = ["44054006", "46635009", "73211009"];
const HYPERTENSION = ["38341003", "59621000"];
const CREATININE_CODES = ["2160-0", "38483-4", "14682-9"];

/** CKD-EPI 2021 (creatinine, race-free). Scr in mg/dL. */
export function ckdEpi2021(sex: "male" | "female", age: number, scrMgDl: number): number {
  const female = sex === "female";
  const k = female ? 0.7 : 0.9;
  const a = female ? -0.241 : -0.302;
  return (
    142 *
    Math.min(scrMgDl / k, 1) ** a *
    Math.max(scrMgDl / k, 1) ** -1.2 *
    0.9938 ** age *
    (female ? 1.012 : 1)
  );
}

export function egfrCategory(egfr: number): "G1" | "G2" | "G3a" | "G3b" | "G4" | "G5" {
  return egfr >= 90
    ? "G1"
    : egfr >= 60
      ? "G2"
      : egfr >= 45
        ? "G3a"
        : egfr >= 30
          ? "G3b"
          : egfr >= 15
            ? "G4"
            : "G5";
}
/** Australian laboratory convention: values above 90 are reported as ">90". */
export const egfrText = (egfr: number) => (Math.round(egfr) > 90 ? ">90" : String(Math.round(egfr)));

export function bmiCategory(bmi: number) {
  const r = Math.round(bmi * 10) / 10;
  return {
    value: r,
    category: r < 18.5 ? "underweight" : r < 25 ? "healthy weight" : r < 30 ? "overweight" : "obese",
  };
}

const when = (o: Observation) => o.effectiveDateTime ?? o.effectivePeriod?.start ?? o.issued;
const ms = (o: Observation) => Date.parse(when(o) ?? "");
const latest = (obs: Observation[]) =>
  obs
    .filter((o) => o.status !== "entered-in-error" && o.status !== "cancelled" && !Number.isNaN(ms(o)))
    .sort((a, b) => ms(b) - ms(a))[0];
const hasCode = (o: Observation, codes: string[]) =>
  o.code?.coding?.some((c) => codes.includes(c.code ?? ""));

function creatinineMgDl(o: Observation): number | undefined {
  const q = o.valueQuantity;
  if (!q || q.value === undefined || !hasCode(o, CREATININE_CODES)) return undefined;
  const unit = (q.code ?? q.unit ?? "").replace(/^µ/, "u");
  return unit === "mg/dL" ? q.value : unit === "umol/L" ? q.value / 88.4 : undefined;
}

/** Conditions the rules may use: active, and not unconfirmed, refuted or entered in error. */
function usable(conditions: Condition[], codes: string[]) {
  return conditions.some((c) => {
    const verification = c.verificationStatus?.coding?.[0]?.code;
    const clinical = c.clinicalStatus?.coding?.[0]?.code;
    return (
      !["unconfirmed", "provisional", "differential", "refuted", "entered-in-error"].includes(
        verification ?? "",
      ) &&
      ["active", "recurrence", "relapse"].includes(clinical ?? "") &&
      c.code?.coding?.some((k) => codes.includes(k.code ?? ""))
    );
  });
}

const card = (summary: string, indicator: Card["indicator"], detail?: string): Card => ({
  uuid: crypto.randomUUID(),
  summary: summary.slice(0, 140),
  indicator,
  detail,
  source: SOURCE,
});

export type EgfrResult =
  | { status: "calculated"; value: number; category: ReturnType<typeof egfrCategory>; date: string }
  | { status: "not-calculated"; reason: string }
  | { status: "none" };

/** eGFR from the latest creatinine; "none" when there is no result or it is older than 12 months. */
export function egfrFor(patient: Patient, creatinine: Observation[], now: Date): EgfrResult {
  const o = latest(creatinine.filter((c) => creatinineMgDl(c) !== undefined));
  if (!o || now.getTime() - ms(o) > 365 * DAY) return { status: "none" };
  const age = ageInYears(patient.birthDate, when(o));
  if (age === undefined || age < 18)
    return { status: "not-calculated", reason: "adult formula: age under 18 or unknown" };
  if (patient.gender !== "male" && patient.gender !== "female")
    return { status: "not-calculated", reason: "sex not recorded as male or female" };
  const value = ckdEpi2021(patient.gender, age, creatinineMgDl(o)!);
  return { status: "calculated", value, category: egfrCategory(value), date: when(o)! };
}

/** Two results at least 90 days apart that are both below 60 mL/min/1.73 m². */
function persistentlyLow(patient: Patient, creatinine: Observation[]): boolean {
  const low = creatinine.flatMap((o) => {
    const scr = creatinineMgDl(o);
    const age = ageInYears(patient.birthDate, when(o));
    const sex = patient.gender;
    return scr !== undefined &&
      age !== undefined &&
      age >= 18 &&
      (sex === "male" || sex === "female") &&
      ckdEpi2021(sex, age, scr) < 60
      ? [ms(o)]
      : [];
  });
  return low.length > 1 && Math.max(...low) - Math.min(...low) >= 90 * DAY;
}

const meters = (o: Observation) => {
  const q = o.valueQuantity;
  if (q?.value === undefined) return undefined;
  return (q.code ?? q.unit) === "m" ? q.value : q.value / 100; // cm otherwise
};

export type CareGap = { type: "diabetes-hba1c" | "hypertension-bp"; summary: string; detail: string };

/** Open care gaps: confirmed, active diabetes with no HbA1c, or hypertension with no blood pressure, in 12 months. */
export function careGaps(i: Inputs, now: Date): CareGap[] {
  if (i.patient.deceasedDateTime || i.patient.deceasedBoolean) return []; // no follow-up for a deceased patient
  const within = (obs: Observation[]) => {
    const o = latest(obs);
    return o !== undefined && (now.getTime() - ms(o)) / DAY <= 365;
  };
  const gaps: CareGap[] = [];
  if (usable(i.conditions, DIABETES) && !within(i.hba1c)) {
    gaps.push({
      type: "diabetes-hba1c",
      summary: "Diabetes: no HbA1c recorded in the last 12 months",
      detail: "Care gap based on confirmed, active diabetes.",
    });
  }
  if (usable(i.conditions, HYPERTENSION) && !within(i.bp)) {
    gaps.push({
      type: "hypertension-bp",
      summary: "Hypertension: no blood pressure recorded in the last 12 months",
      detail: "Care gap based on confirmed, active hypertension.",
    });
  }
  return gaps;
}

/** `now` is injected so every rule is testable. */
export function evaluate(i: Inputs, now: Date = new Date()): Card[] {
  if (i.patient.deceasedDateTime || i.patient.deceasedBoolean) return [];
  const cards: Card[] = [];
  const age = ageInYears(i.patient.birthDate, now);

  const egfr = egfrFor(i.patient, i.creatinine, now);
  if (egfr.status === "calculated") {
    const persistent = persistentlyLow(i.patient, i.creatinine);
    cards.push(
      card(
        `eGFR ${egfrText(egfr.value)} mL/min/1.73 m² (CKD-EPI 2021), eGFR category ${egfr.category}`,
        egfr.category === "G4" || egfr.category === "G5"
          ? "critical"
          : egfr.category.startsWith("G3")
            ? "warning"
            : "info",
        egfr.value < 60 && !persistent
          ? "A single result; CKD needs results below 60 for 3 months or more."
          : "Calculated from the latest creatinine.",
      ),
    );
  } else if (egfr.status === "not-calculated") {
    cards.push(card(`eGFR not calculated: ${egfr.reason}`, "info"));
  }

  const kg = latest(i.weight)?.valueQuantity?.value;
  const m = latest(i.height) && meters(latest(i.height)!);
  if (age !== undefined && age >= 18 && kg && m) {
    const { value, category } = bmiCategory(kg / m ** 2);
    cards.push(
      card(`BMI ${value.toFixed(1)} kg/m²: ${category}`, category === "healthy weight" ? "info" : "warning"),
    );
  }

  for (const gap of careGaps(i, now)) cards.push(card(gap.summary, "warning", gap.detail));
  return cards;
}
