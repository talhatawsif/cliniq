import { describe, expect, it } from "vitest";
import type { Condition, DocumentReference, Encounter, FhirResource, Observation } from "fhir/r4";
import { checkCohort } from "./checks.ts";
import { TEST_IDENTIFIERS, isIhi, luhnValid, testIhi } from "./ids.ts";
import { collectRefs, rewriteRefs, scrubNote, trim } from "./lib.ts";
import { convertToSi, hba1cToIfcc } from "./units.ts";

describe("Australian identifiers", () => {
  it("checks the IHI Luhn digit", () => {
    expect(isIhi("8003608833357361")).toBe(true);
    expect(isIhi("8003608833357362")).toBe(false);
    expect(isIhi("8003618833357361")).toBe(false); // provider prefix, not an individual
  });

  it("uses only identifiers reserved for testing, all with valid check digits", () => {
    expect(TEST_IDENTIFIERS.ihi.every(isIhi)).toBe(true);
    expect(TEST_IDENTIFIERS.hpii.every((v) => /^800361\d{10}$/.test(v) && luhnValid(v))).toBe(true);
    expect(TEST_IDENTIFIERS.hpio.every((v) => /^800362\d{10}$/.test(v) && luhnValid(v))).toBe(true);
    expect(testIhi(0)).toBe(TEST_IDENTIFIERS.ihi[0]);
    expect(() => testIhi(10_000)).toThrow(/test IHI/);
  });
});

const lab = (code: string, value: number, unit = "mg/dL"): Observation => ({
  resourceType: "Observation",
  status: "final",
  code: { coding: [{ system: "http://loinc.org", code }] },
  valueQuantity: { value, unit, system: "http://unitsofmeasure.org", code: unit },
});

describe("SI unit conversion", () => {
  it("converts creatinine and re-codes it to the molar LOINC code", () => {
    const o = lab("2160-0", 1.0);
    expect(convertToSi(o)).toBe(true);
    expect(o.code.coding?.[0].code).toBe("14682-9");
    expect(o.valueQuantity).toMatchObject({
      value: 88.4,
      code: "umol/L",
      system: "http://unitsofmeasure.org",
    });
    const blood = lab("38483-4", 1.0);
    convertToSi(blood);
    expect(blood.code.coding?.[0].code).toBe("14682-9");
  });

  it("converts glucose and cholesterol", () => {
    const glucose = lab("2339-0", 100);
    convertToSi(glucose);
    expect(glucose.valueQuantity?.value).toBe(5.55);
    expect(glucose.code.coding?.[0].code).toBe("15074-8");
    const cholesterol = lab("2093-3", 200);
    convertToSi(cholesterol);
    expect(cholesterol.valueQuantity?.value).toBe(5.17);
    expect(cholesterol.valueQuantity?.code).toBe("mmol/L");
  });

  it("HbA1c 7.0 % is 53 mmol/mol", () => {
    expect(hba1cToIfcc(7.0)).toBe(53);
    expect(hba1cToIfcc(6.5)).toBe(48);
  });

  it("leaves anything else untouched", () => {
    const hba1c = lab("4548-4", 7, "%");
    expect(convertToSi(hba1c)).toBe(false);
    expect(hba1c.valueQuantity?.value).toBe(7);
    const alreadySi = lab("2160-0", 88.4, "umol/L");
    expect(convertToSi(alreadySi)).toBe(false);
    expect(alreadySi.code.coding?.[0].code).toBe("2160-0");
  });
});

describe("note scrubbing", () => {
  it("removes race, the insurer line and digits in names", () => {
    const text =
      "Adriana394 Ramona980 is a 18 year-old hispanic white female.\nPatient currently has Anthem.\nPatient has never smoked.\n";
    expect(scrubNote(text)).toBe("Adriana Ramona is a 18 year-old female.\nPatient has never smoked.\n");
    expect(scrubNote("Mo is a 3 month-old non-hispanic black male.")).toBe("Mo is a 3 month-old male.");
  });
});

describe("trim", () => {
  const encounter = (id: string, start: string): Encounter => ({
    resourceType: "Encounter",
    id,
    status: "finished",
    class: {},
    period: { start },
  });
  const obs = (id: string, date: string, category = "laboratory"): Observation => ({
    resourceType: "Observation",
    id,
    status: "final",
    code: {},
    category: [{ coding: [{ code: category }] }],
    effectiveDateTime: date,
  });
  const note = (i: number): DocumentReference => ({
    resourceType: "DocumentReference",
    id: `d${i}`,
    status: "current",
    content: [],
    date: `2026-01-${String(i + 1).padStart(2, "0")}`,
  });
  const oldCondition: Condition = {
    resourceType: "Condition",
    id: "c1",
    subject: {},
    encounter: { reference: "urn:uuid:e-old" },
  };
  const all: FhirResource[] = [
    { resourceType: "Patient", id: "p" },
    encounter("e-old", "2001-01-01"),
    encounter("e-unreferenced-old", "2001-01-01"),
    encounter("e-new", "2026-01-01"),
    oldCondition,
    obs("o-old", "2015-01-01"),
    obs("o-new", "2026-01-01"),
    obs("o-survey", "2026-01-01", "survey"),
    { resourceType: "Claim", id: "claim" } as FhirResource,
    ...Array.from({ length: 12 }, (_, i) => note(i)),
  ];
  const kept = trim(all, 5, "2026-11-13").map((r) => r.id);

  it("keeps problems and anything recent, drops old and unwanted types", () => {
    expect(kept).toEqual(expect.arrayContaining(["p", "c1", "e-new", "o-new"]));
    expect(kept).not.toContain("o-old");
    expect(kept).not.toContain("o-survey");
    expect(kept).not.toContain("claim");
    expect(kept).not.toContain("e-unreferenced-old");
  });

  it("keeps an old encounter that a kept resource points at", () => {
    expect(kept).toContain("e-old");
  });

  it("keeps the 10 most recent notes", () => {
    const notes = kept.filter((id) => id?.startsWith("d"));
    expect(notes).toHaveLength(10);
    expect(notes).not.toContain("d0");
    expect(notes).toContain("d11");
  });
});

describe("reference rewriting", () => {
  it("rewrites known references and removes unknown ones", () => {
    const out = rewriteRefs(
      {
        subject: { reference: "urn:uuid:p", display: "Old123" },
        encounter: { reference: "urn:uuid:gone" },
        result: [{ reference: "urn:uuid:gone" }, { reference: "urn:uuid:o" }],
      },
      (ref) =>
        ({
          "urn:uuid:p": { reference: "Patient/p", display: "New" },
          "urn:uuid:o": { reference: "Observation/o" },
        })[ref],
    );
    expect(out).toEqual({
      subject: { reference: "Patient/p", display: "New" },
      result: [{ reference: "Observation/o" }],
    });
    expect(collectRefs(out)).toEqual(["Patient/p", "Observation/o"]);
  });
});

describe("committed cohort", () => {
  it("passes every cohort rule (size, references, identifiers, no US leftovers)", () => {
    expect(checkCohort("data/cohort")).toEqual([]);
  });
});
