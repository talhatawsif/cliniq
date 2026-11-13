import type { Observation } from "fhir/r4";

// US mass units → Australian SI units. A LOINC code is specific to the measured property, so the
// code changes with the unit. Displays confirmed with $lookup on tx.fhir.org (13 Nov 2026).
type Conversion = { to: string; display: string; unit: string; factor: number; decimals: number };

const mmol = (to: string, display: string, factor: number): Conversion => ({
  to,
  display,
  unit: "mmol/L",
  factor,
  decimals: 2,
});

export const CONVERSIONS: Record<string, Conversion> = {
  "2160-0": {
    to: "14682-9",
    display: "Creatinine [Moles/volume] in Serum or Plasma",
    unit: "umol/L",
    factor: 88.4,
    decimals: 1,
  },
  "38483-4": {
    to: "14682-9",
    display: "Creatinine [Moles/volume] in Serum or Plasma",
    unit: "umol/L",
    factor: 88.4,
    decimals: 1,
  },
  "2339-0": mmol("15074-8", "Glucose [Moles/volume] in Blood", 1 / 18.016),
  "2093-3": mmol("14647-2", "Cholesterol [Moles/volume] in Serum or Plasma", 0.02586),
  "2085-9": mmol("14646-4", "Cholesterol in HDL [Moles/volume] in Serum or Plasma", 0.02586),
  "18262-6": mmol("22748-8", "Cholesterol in LDL [Moles/volume] in Serum or Plasma", 0.02586),
  "2571-8": mmol("14927-8", "Triglyceride [Moles/volume] in Serum or Plasma", 0.01129),
};

const round = (value: number, decimals: number) => Number(value.toFixed(decimals));

/** HbA1c: NGSP % → IFCC mmol/mol (master equation), whole number. */
export const hba1cToIfcc = (percent: number) => Math.round((percent - 2.15) * 10.929);

/** Converts a mass-unit result in place to SI and re-codes it. Returns true when converted. */
export function convertToSi(obs: Observation): boolean {
  const coding = obs.code.coding?.find(
    (c) => c.system === "http://loinc.org" && c.code && c.code in CONVERSIONS,
  );
  const q = obs.valueQuantity;
  if (!coding?.code || q?.value === undefined || q.code !== "mg/dL") return false;
  const c = CONVERSIONS[coding.code];
  coding.code = c.to;
  coding.display = c.display;
  obs.code.text = c.display;
  obs.valueQuantity = {
    value: round(q.value * c.factor, c.decimals),
    unit: c.unit === "umol/L" ? "µmol/L" : c.unit,
    system: "http://unitsofmeasure.org",
    code: c.unit,
  };
  return true;
}
