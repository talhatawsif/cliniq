import type { AllergyIntolerance, Condition, Patient } from "fhir/r4";
import { describe, expect, it } from "vitest";
import { allergyStatus, banner, formatIhi, medicineText, problemList } from "./clinical";

const cond = (clinical: string, verification = "confirmed"): Condition => ({
  resourceType: "Condition",
  subject: { reference: "Patient/1" },
  clinicalStatus: { coding: [{ code: clinical }] },
  verificationStatus: { coding: [{ code: verification }] },
});
const patient: Patient = {
  resourceType: "Patient",
  name: [{ use: "official", family: "Citizen", given: ["Jane", "Q"] }],
  birthDate: "1970-01-01",
  gender: "female",
  identifier: [{ system: "http://ns.electronichealth.net.au/id/hi/ihi/1.0", value: "8003608166980383" }],
};

describe("formatIhi", () => {
  it("groups 16 digits as 4-4-4-4", () => expect(formatIhi("8003608166980383")).toBe("8003 6081 6698 0383"));
  it("rejects anything else", () => {
    expect(formatIhi("123")).toBeNull();
    expect(formatIhi(undefined)).toBeNull();
  });
});

describe("banner", () => {
  it("formats a living patient", () => {
    const b = banner(patient, new Date("2026-11-13T00:00:00Z"));
    expect(b).toMatchObject({
      family: "CITIZEN",
      given: "Jane Q",
      dob: "01/01/1970",
      status: "56 y",
      ihi: "8003 6081 6698 0383",
    });
  });
  it("uses age at death and shows the date", () => {
    const b = banner({ ...patient, deceasedDateTime: "2020-06-30T10:00:00+10:00" }, new Date("2026-11-13"));
    expect(b.deceased).toBe(true);
    expect(b.status).toBe("Deceased 30/06/2020");
  });
});

describe("problemList", () => {
  it("drops refuted and entered-in-error, keeps resolved apart", () => {
    const { active, inactive } = problemList([
      cond("active"),
      cond("active", "refuted"),
      cond("active", "entered-in-error"),
      cond("resolved"),
      cond("recurrence"),
    ]);
    expect(active).toHaveLength(2);
    expect(inactive).toHaveLength(1);
  });
});

describe("allergyStatus", () => {
  const allergy = (c: string): AllergyIntolerance => ({
    resourceType: "AllergyIntolerance",
    patient: { reference: "Patient/1" },
    code: { coding: [{ system: "http://snomed.info/sct", code: c }] },
  });
  it("distinguishes nothing recorded from no known allergies", () => {
    expect(allergyStatus([])).toBe("none-recorded");
    expect(allergyStatus([allergy("716186003")])).toBe("no-known");
    expect(allergyStatus([allergy("7984")])).toBe("listed");
  });
});

describe("medicineText", () => {
  it.each([
    ["metformin 5.0 MG Oral Tablet", "metformin 5 mg oral tablet"],
    ["warfarin .5 mg tablet", "warfarin 0.5 mg tablet"],
    ["Amoxicillin 500mg", "amoxicillin 500 mg"],
    ["sodium fluoride 0.0272 MG/MG Oral Gel", "sodium fluoride 0.0272 mg/mg oral gel"],
  ])("%s", (input, expected) => expect(medicineText(input)).toBe(expected));
});
