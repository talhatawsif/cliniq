import type { Observation } from "fhir/r4";
import { describe, expect, it } from "vitest";
import { buildTrends, formatResult } from "./analytes";

let n = 0;
const obs = (
  code: string,
  value: number | undefined,
  unit?: string,
  extra: Partial<Observation> = {},
): Observation => ({
  resourceType: "Observation",
  id: `o${++n}`,
  status: "final",
  code: { coding: [{ system: "http://loinc.org", code, display: `disp ${code}` }] },
  effectiveDateTime: `2026-01-${String(n).padStart(2, "0")}T00:00:00Z`,
  ...(value !== undefined && {
    valueQuantity: { value, unit, code: unit, system: "http://unitsofmeasure.org" },
  }),
  ...extra,
});
const labels = (o: Observation[]) => buildTrends(o).series.map((s) => s.label);

describe("trends", () => {
  it("L1 creatinine mg/dL and µmol/L become one series in µmol/L", () => {
    const { series } = buildTrends([obs("2160-0", 1.0, "mg/dL"), obs("14682-9", 88.4, "umol/L")]);
    expect(series).toHaveLength(1);
    expect(series[0]).toMatchObject({ label: "Creatinine", unit: "µmol/L" });
    expect(series[0].points.map((p) => Math.round(p.value))).toEqual([88, 88]);
  });
  it("L2 both creatinine LOINC codes share a series", () =>
    expect(labels([obs("38483-4", 1, "mg/dL"), obs("2160-0", 1, "mg/dL")])).toEqual(["Creatinine"]));
  it("L3 SpO2 codes share a series", () =>
    expect(labels([obs("59408-5", 97, "%"), obs("2708-6", 96, "%")])).toEqual(["SpO2"]));
  it("L4 BP panel plus a standalone systolic is one chart", () => {
    const panel = obs("85354-9", undefined, undefined, {
      component: [
        { code: { coding: [{ system: "http://loinc.org", code: "8480-6" }] }, valueQuantity: { value: 130 } },
        { code: { coding: [{ system: "http://loinc.org", code: "8462-4" }] }, valueQuantity: { value: 80 } },
      ],
    });
    const { bp, series } = buildTrends([panel, obs("8480-6", 142, "mm[Hg]")]);
    expect(series).toHaveLength(0);
    expect(bp?.systolic.map((p) => p.value).sort()).toEqual([130, 142]);
    expect(bp?.diastolic).toHaveLength(1);
    expect(formatResult(panel)).toBe("130/80 mmHg");
  });
  it("L5 reported eGFR in two unit spellings is one series", () => {
    const { series } = buildTrends([obs("33914-3", 60, "mL/min/{1.73_m2}"), obs("33914-3", 55, "mL/min")]);
    expect(series).toHaveLength(1);
    expect(series[0].label).toBe("eGFR (reported, MDRD)");
  });
  it("L6 same display, different unknown codes: two series", () => {
    const a = obs("11111-1", 1, "x");
    const b = obs("22222-2", 2, "x");
    a.code.coding![0].display = b.code.coding![0].display = "Mystery";
    expect(buildTrends([a, b]).series).toHaveLength(2);
  });
  it("L7 unit with no conversion stays separate and is flagged", () => {
    const { series } = buildTrends([
      obs("2339-0", 90, "mg/dL"),
      obs("15074-8", 5, "mmol/L"),
      obs("2339-0", 5, "weird"),
    ]);
    expect(series.filter((s) => s.label === "Glucose")).toHaveLength(2);
    expect(series.every((s) => s.mixedUnits)).toBe(true);
  });
  it("L8 entered-in-error and cancelled are excluded", () => {
    const t = buildTrends([
      obs("2160-0", 1, "mg/dL", { status: "entered-in-error" }),
      obs("2160-0", 1, "mg/dL", { status: "cancelled" }),
    ]);
    expect(t.series).toHaveLength(0);
    expect(t.included).toHaveLength(0);
  });
  it("L9 text results are listed, not charted", () => {
    const t = buildTrends([obs("72166-2", undefined, undefined, { valueString: "Never smoker" })]);
    expect(t.series).toHaveLength(0);
    expect(t.nonNumeric).toHaveLength(1);
    expect(formatResult(t.nonNumeric[0])).toBe("Never smoker");
  });
  it("L10 converts on the UCUM code, whatever the unit text says", () => {
    const o = obs("2160-0", 1, "mg/dL");
    o.valueQuantity!.unit = "milligrams per deciliter";
    expect(buildTrends([o]).series[0].points[0].value).toBeCloseTo(88.4);
  });
  it("L11 HbA1c shows IFCC units", () =>
    expect(formatResult(obs("4548-4", 7.0, "%"))).toBe("7.0 % (53 mmol/mol)"));
  it("takes the reference range from the resource only", () => {
    const withRange = obs("14682-9", 90, "umol/L", {
      referenceRange: [{ low: { value: 45 }, high: { value: 90 } }],
    });
    expect(buildTrends([withRange]).series[0].ref).toEqual({ low: 45, high: 90 });
    expect(buildTrends([obs("14682-9", 90, "umol/L")]).series[0].ref).toBeUndefined();
  });
});
