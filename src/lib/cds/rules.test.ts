import type { Condition, Observation, Patient } from "fhir/r4";
import { describe, expect, it } from "vitest";
import { bmiCategory, ckdEpi2021, egfrCategory, egfrFor, egfrText, evaluate, type Inputs } from "./rules";

const NOW = new Date("2026-11-13T00:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

const patient = (gender: Patient["gender"], age: number): Patient => ({
  resourceType: "Patient",
  gender,
  birthDate: `${2026 - age}-01-01`, // birthday already passed this year
});
const loinc = (code: string) => ({ coding: [{ system: "http://loinc.org", code }] });
const quantity = (code: string, value: number, unit: string, days = 10): Observation => ({
  resourceType: "Observation",
  status: "final",
  code: loinc(code),
  effectiveDateTime: daysAgo(days),
  valueQuantity: { value, unit, code: unit },
});
const condition = (snomed: string, verification = "confirmed", clinical = "active"): Condition => ({
  resourceType: "Condition",
  subject: { reference: "Patient/1" },
  code: { coding: [{ system: "http://snomed.info/sct", code: snomed }] },
  clinicalStatus: { coding: [{ code: clinical }] },
  verificationStatus: { coding: [{ code: verification }] },
});
const inputs = (p: Patient, over: Partial<Inputs> = {}): Inputs => ({
  patient: p,
  conditions: [],
  creatinine: [],
  weight: [],
  height: [],
  hba1c: [],
  bp: [],
  ...over,
});

describe("CKD-EPI 2021 (E1–E11)", () => {
  it.each([
    ["E1", "male", 50, 1.0, "92", "G1", ">90"],
    ["E2", "female", 50, 1.0, "69", "G2", "69"],
    ["E3", "female", 30, 0.6, "124", "G1", ">90"],
    ["E4", "male", 40, 0.9, "111", "G1", ">90"],
    ["E5", "female", 40, 0.7, "112", "G1", ">90"],
    ["E6", "male", 70, 2.0, "35", "G3b", "35"],
    ["E7", "female", 65, 1.5, "38", "G3b", "38"],
    ["E8", "male", 60, 4.0, "16", "G4", "16"],
    ["E9", "female", 55, 8.0, "5", "G5", "5"],
    ["E10", "male", 80, 1.2, "61", "G2", "61"],
    ["E11", "female", 67, 132 / 88.4, "38", "G3b", "38"],
  ] as const)("%s", (_id, sex, age, scr, rounded, category, shown) => {
    const v = ckdEpi2021(sex, age, scr);
    expect(String(Math.round(v))).toBe(rounded);
    expect(egfrCategory(v)).toBe(category);
    expect(egfrText(v)).toBe(shown);
  });
});

describe("eGFR eligibility (E12–E14)", () => {
  const cr = [quantity("2160-0", 1.0, "mg/dL")];
  it("E12 under 18: not calculated, adult formula", () => {
    const r = egfrFor(patient("male", 17), cr, NOW);
    expect(r).toMatchObject({ status: "not-calculated" });
    expect((r as { reason: string }).reason).toContain("adult formula");
  });
  it.each([undefined, "other", "unknown"] as const)("E13 sex %s: not calculated with a reason", (sex) => {
    expect(egfrFor(patient(sex, 50), cr, NOW)).toMatchObject({
      status: "not-calculated",
      reason: expect.stringContaining("sex"),
    });
  });
  it("E14 no creatinine, or latest older than 12 months: no eGFR", () => {
    expect(egfrFor(patient("male", 50), [], NOW).status).toBe("none");
    expect(egfrFor(patient("male", 50), [quantity("2160-0", 1.0, "mg/dL", 400)], NOW).status).toBe("none");
  });
  it("accepts µmol/L creatinine", () => {
    expect(egfrFor(patient("female", 67), [quantity("14682-9", 132, "umol/L")], NOW)).toMatchObject({
      status: "calculated",
      category: "G3b",
    });
  });
});

describe("cards", () => {
  it("a single low eGFR says CKD needs 3 months", () => {
    const [c] = evaluate(
      inputs(patient("male", 70), { creatinine: [quantity("2160-0", 2.0, "mg/dL")] }),
      NOW,
    );
    expect(c.summary).toContain("eGFR category G3b");
    expect(c.detail).toContain("3 months");
    expect(c.indicator).toBe("warning");
  });
  it("two low results 90+ days apart drop the caveat", () => {
    const creatinine = [quantity("2160-0", 2.0, "mg/dL", 10), quantity("2160-0", 2.0, "mg/dL", 120)];
    expect(evaluate(inputs(patient("male", 70), { creatinine }), NOW)[0].detail).not.toContain("3 months");
  });
  it("summary stays within 140 characters and cards have the required fields", () => {
    const cards = evaluate(
      inputs(patient("male", 70), { creatinine: [quantity("2160-0", 2.0, "mg/dL")] }),
      NOW,
    );
    for (const c of cards) {
      expect(c.summary.length).toBeLessThanOrEqual(140);
      expect(c.uuid).toBeTruthy();
      expect(c.source.label).toBeTruthy();
    }
  });
  it("a deceased patient gets no cards", () => {
    const p = { ...patient("male", 70), deceasedDateTime: daysAgo(30) };
    expect(evaluate(inputs(p, { creatinine: [quantity("2160-0", 2.0, "mg/dL")] }), NOW)).toEqual([]);
  });
});

describe("BMI", () => {
  const withBmi = (age: number, kg: number, m: number) =>
    evaluate(
      inputs(patient("female", age), {
        weight: [quantity("29463-7", kg, "kg")],
        height: [quantity("8302-2", m * 100, "cm")],
      }),
      NOW,
    );
  it("70 kg / 1.75 m is 22.9, healthy weight", () => {
    expect(bmiCategory(70 / 1.75 ** 2)).toEqual({ value: 22.9, category: "healthy weight" });
    expect(withBmi(40, 70, 1.75)[0].summary).toContain("22.9");
  });
  it("91.9 kg / 1.75 m is 30.0, obese (classified after rounding)", () => {
    expect(bmiCategory(91.9 / 1.75 ** 2)).toEqual({ value: 30, category: "obese" });
  });
  it("age 10 gets no BMI card", () => expect(withBmi(10, 40, 1.4)).toEqual([]));
});

describe("care gaps", () => {
  const gap = (cond: Condition, days: number | null, code: string, value = 6.5, unit = "%") =>
    evaluate(
      inputs(patient("male", 50), {
        conditions: [cond],
        [code === "4548-4" ? "hba1c" : "bp"]: days === null ? [] : [quantity(code, value, unit, days)],
      }),
      NOW,
    );
  it("diabetes: 364 days ago no card, 366 days a card", () => {
    expect(gap(condition("44054006"), 364, "4548-4")).toEqual([]);
    expect(gap(condition("44054006"), 366, "4548-4")[0].summary).toContain("HbA1c");
    expect(gap(condition("44054006"), null, "4548-4")).toHaveLength(1);
  });
  it("hypertension: same boundary for blood pressure", () => {
    expect(gap(condition("38341003"), 364, "8480-6", 130, "mm[Hg]")).toEqual([]);
    expect(gap(condition("38341003"), 366, "8480-6", 130, "mm[Hg]")[0].summary).toContain("blood pressure");
  });
  it("an unconfirmed, refuted or resolved diagnosis gives no card", () => {
    expect(gap(condition("44054006", "unconfirmed"), null, "4548-4")).toEqual([]);
    expect(gap(condition("44054006", "refuted"), null, "4548-4")).toEqual([]);
    expect(gap(condition("44054006", "confirmed", "resolved"), null, "4548-4")).toEqual([]);
  });
});
