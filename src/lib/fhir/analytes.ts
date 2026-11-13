import type { CodeableConcept, Observation, Quantity } from "fhir/r4";
import { codeableText, quantityText } from "./display";

type Analyte = { label: string; unit: string; codes: string[]; conv?: Record<string, number> };

// Trending groups by analyte, not by LOINC code (SPEC §2). `conv` maps a UCUM unit to the factor
// that converts it to `unit`. Anything not listed here is trended per code and never merged by text.
const ANALYTES: Record<string, Analyte> = {
  creatinine: {
    label: "Creatinine",
    unit: "umol/L",
    codes: ["2160-0", "38483-4", "14682-9"],
    conv: { "mg/dL": 88.4 },
  },
  glucose: { label: "Glucose", unit: "mmol/L", codes: ["2339-0", "15074-8"], conv: { "mg/dL": 1 / 18.016 } },
  cholesterol: {
    label: "Total cholesterol",
    unit: "mmol/L",
    codes: ["2093-3", "14647-2"],
    conv: { "mg/dL": 0.02586 },
  },
  hdl: { label: "HDL cholesterol", unit: "mmol/L", codes: ["2085-9", "14646-4"], conv: { "mg/dL": 0.02586 } },
  ldl: {
    label: "LDL cholesterol",
    unit: "mmol/L",
    codes: ["18262-6", "22748-8"],
    conv: { "mg/dL": 0.02586 },
  },
  triglycerides: {
    label: "Triglycerides",
    unit: "mmol/L",
    codes: ["2571-8", "14927-8"],
    conv: { "mg/dL": 0.01129 },
  },
  spo2: { label: "SpO2", unit: "%", codes: ["59408-5", "2708-6"] },
  egfr: {
    label: "eGFR (reported, MDRD)",
    unit: "mL/min/{1.73_m2}",
    codes: ["33914-3"],
    conv: { "mL/min": 1 },
  },
};
const ANALYTE_BY_CODE = new Map(
  Object.entries(ANALYTES).flatMap(([k, a]) => a.codes.map((c) => [c, k] as const)),
);

const BP_PANEL = "85354-9";
const SYSTOLIC = "8480-6";
const DIASTOLIC = "8462-4";
const HBA1C = "4548-4";

const UNIT_TEXT: Record<string, string> = {
  "umol/L": "µmol/L",
  "mL/min/{1.73_m2}": "mL/min/1.73 m²",
  "10*3/uL": "×10³/µL",
  "10*6/uL": "×10⁶/µL",
  "mm[Hg]": "mmHg",
  "/min": "/min",
  "{score}": "score",
};
export const unitText = (q: Quantity | undefined, ucum = q?.code) =>
  (ucum && UNIT_TEXT[ucum]) || q?.unit || ucum || "";

export type Flag = "High" | "Low" | "Abnormal";
export type Point = {
  t: number;
  date: string;
  value: number;
  flag?: Flag;
  obs: Observation;
  /** What the source unit was multiplied by to reach the series unit (1 when none). */
  factor?: number;
};
export type Series = {
  key: string;
  label: string;
  unit: string;
  points: Point[];
  ref?: { low?: number; high?: number };
  mixedUnits: boolean;
};
export type Trends = {
  series: Series[];
  bp: { systolic: Point[]; diastolic: Point[] } | null;
  /** Included results with no numeric value: shown in the table, never charted. */
  nonNumeric: Observation[];
  /** Every included (not cancelled / entered-in-error) observation, newest first. */
  included: Observation[];
};

export const isIncluded = (o: Observation) => o.status !== "entered-in-error" && o.status !== "cancelled";

const day = (o: Observation) =>
  o.effectiveDateTime ?? o.effectivePeriod?.start ?? o.effectiveInstant ?? o.issued;
const time = (o: Observation) => {
  const t = Date.parse(day(o) ?? "");
  return Number.isNaN(t) ? undefined : t;
};

export function flagOf(o: Observation): Flag | undefined {
  const code = o.interpretation?.[0]?.coding?.[0]?.code;
  if (code === "H" || code === "HH") return "High";
  if (code === "L" || code === "LL") return "Low";
  return code === "A" || code === "AA" ? "Abnormal" : undefined;
}

const loincOf = (cc: CodeableConcept | undefined) =>
  cc?.coding?.filter((c) => c.system === "http://loinc.org").map((c) => c.code ?? "") ?? [];
const loinc = (o: Observation) => loincOf(o.code);

function point(o: Observation, value: number): Point | undefined {
  const t = time(o);
  return t === undefined ? undefined : { t, date: day(o)!, value, flag: flagOf(o), obs: o };
}

export function buildTrends(all: Observation[]): Trends {
  const included = all.filter(isIncluded).sort((a, b) => (time(b) ?? 0) - (time(a) ?? 0));
  const bp = { systolic: [] as Point[], diastolic: [] as Point[] };
  const nonNumeric: Observation[] = [];
  const groups = new Map<
    string,
    { label: string; analyte?: Analyte; byUnit: Map<string, { text: string; points: Point[] }> }
  >();

  for (const o of included) {
    const codes = loinc(o);
    if (codes.includes(BP_PANEL)) {
      for (const c of o.component ?? []) {
        const v = c.valueQuantity?.value;
        const target = loincOf(c.code).find((x) => x === SYSTOLIC || x === DIASTOLIC);
        const p = v === undefined || !target ? undefined : point(o, v);
        if (p) (target === SYSTOLIC ? bp.systolic : bp.diastolic).push(p);
      }
      continue;
    }
    const standalone = codes.find((x) => x === SYSTOLIC || x === DIASTOLIC);
    const q = o.valueQuantity;
    if (q?.value === undefined) {
      nonNumeric.push(o);
      continue;
    }
    const p = point(o, q.value);
    if (!p) {
      nonNumeric.push(o);
      continue;
    }
    if (standalone) {
      (standalone === SYSTOLIC ? bp.systolic : bp.diastolic).push(p);
      continue;
    }

    const analyteKey = codes.map((c) => ANALYTE_BY_CODE.get(c)).find(Boolean);
    const analyte = analyteKey ? ANALYTES[analyteKey] : undefined;
    const coding = o.code?.coding?.[0];
    const key =
      analyteKey ?? (coding?.code ? `${coding.system}|${coding.code}` : `text|${codeableText(o.code)}`);
    // Convert on the UCUM code, not the free-text unit (L10).
    const ucum = (q.code ?? q.unit ?? "").replace(/^µ/, "u");
    const factor = analyte?.conv?.[ucum];
    const unit = factor !== undefined || ucum === analyte?.unit ? analyte!.unit : ucum;
    if (factor !== undefined) {
      p.value = q.value * factor;
      p.factor = factor;
    }

    const group = groups.get(key) ?? {
      label: analyte?.label ?? codeableText(o.code),
      analyte,
      byUnit: new Map(),
    };
    const bucket = group.byUnit.get(unit) ?? { text: unitText(q, unit), points: [] };
    bucket.points.push(p);
    group.byUnit.set(unit, bucket);
    groups.set(key, group);
  }

  const series: Series[] = [];
  for (const [key, g] of groups) {
    for (const [unit, b] of g.byUnit) {
      b.points.sort((x, y) => x.t - y.t);
      const range = b.points.at(-1)?.obs.referenceRange?.[0];
      // The range is in the unit of the result it came with, so it is converted like the values are.
      const scale = b.points.at(-1)?.factor ?? 1;
      const low = range?.low?.value === undefined ? undefined : range.low.value * scale;
      const high = range?.high?.value === undefined ? undefined : range.high.value * scale;
      series.push({
        key: g.byUnit.size > 1 ? `${key}|${unit}` : key,
        label: g.label,
        unit: g.analyte && unit === g.analyte.unit ? unitText(undefined, unit) : b.text,
        points: b.points,
        ref: low === undefined && high === undefined ? undefined : { low, high },
        mixedUnits: g.byUnit.size > 1,
      });
    }
  }
  bp.systolic.sort((a, b) => a.t - b.t);
  bp.diastolic.sort((a, b) => a.t - b.t);
  return { series, bp: bp.systolic.length + bp.diastolic.length ? bp : null, nonNumeric, included };
}

/** Result as displayed: HbA1c also shows IFCC units; text results are shown as given. */
export function formatResult(o: Observation): string {
  if (loinc(o).includes(BP_PANEL)) {
    const part = (code: string) =>
      o.component?.find((c) => loincOf(c.code).includes(code))?.valueQuantity?.value;
    const [sys, dia] = [part(SYSTOLIC), part(DIASTOLIC)];
    return sys !== undefined && dia !== undefined ? `${sys}/${dia} mmHg` : "—";
  }
  const q = o.valueQuantity;
  if (q?.value !== undefined) {
    if (loinc(o).includes(HBA1C) && (q.code === "%" || q.unit === "%")) {
      return `${q.value.toFixed(1)} % (${Math.round((q.value - 2.15) * 10.929)} mmol/mol)`;
    }
    return quantityText({ ...q, unit: unitText(q) });
  }
  if (o.valueCodeableConcept) return codeableText(o.valueCodeableConcept);
  return o.valueString ?? (o.valueInteger !== undefined ? String(o.valueInteger) : "—");
}

export function referenceText(o: Observation): string {
  const r = o.referenceRange?.[0];
  if (!r) return "—";
  if (r.text) return r.text;
  const [lo, hi] = [r.low?.value, r.high?.value];
  const unit = unitText(r.low ?? r.high);
  return lo !== undefined && hi !== undefined
    ? `${lo}–${hi} ${unit}`
    : lo !== undefined
      ? `≥ ${lo} ${unit}`
      : hi !== undefined
        ? `≤ ${hi} ${unit}`
        : "—";
}
