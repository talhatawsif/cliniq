import { describe, expect, it } from "vitest";
import type { Condition, Observation, Patient } from "fhir/r4";
import patient from "../../../tests/fixtures/patient.json";
import conditions from "../../../tests/fixtures/conditions.json";
import observations from "../../../tests/fixtures/observations.json";
import { ageInYears, codeableText, formatDate, humanName, quantityText } from "./display";

describe("display helpers (Synthea fixtures)", () => {
  it("names", () => {
    expect(humanName((patient as Patient).name)).toBe("Marquis364 Tyson541 Russel238");
    expect(humanName(undefined)).toBe("Unknown name");
    expect(
      humanName([
        { use: "nickname", given: ["Mo"] },
        { use: "official", family: "Lee" },
      ]),
    ).toBe("Lee");
  });

  it("codeable concepts", () => {
    expect(codeableText((conditions as Condition[])[0].code)).toBe("Received higher education (finding)");
    expect(codeableText({ coding: [{ code: "38341003" }] })).toBe("38341003");
    expect(codeableText(undefined, "Unknown allergen")).toBe("Unknown allergen");
  });

  it("quantities", () => {
    const hba1c = (observations as Observation[]).find((o) => o.valueQuantity?.unit === "%");
    expect(quantityText(hba1c?.valueQuantity)).toBe("6.33 %");
    expect(quantityText({ value: 93.123456, unit: "kg" })).toBe("93.12 kg");
    expect(quantityText({ value: 5, comparator: "<", unit: "mmol/L" })).toBe("<5 mmol/L");
    expect(quantityText(undefined)).toBe("—");
  });

  it("dates are DD/MM/YYYY and keep partial precision", () => {
    expect(formatDate("1978-02-10")).toBe("10/02/1978");
    expect(formatDate("1978-02")).toBe("02/1978");
    expect(formatDate("1978")).toBe("1978");
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("not a date")).toBe("—");
  });

  it("a dateTime is shown as the Sydney calendar day", () => {
    expect(formatDate("2017-04-21T08:26:48+10:00")).toBe("21/04/2017");
    // 23:30 UTC on the 20th is already the 21st in Sydney.
    expect(formatDate("2017-04-20T23:30:00Z")).toBe("21/04/2017");
  });

  it("age in whole years", () => {
    expect(ageInYears("1978-02-10", "2026-02-09")).toBe(47);
    expect(ageInYears("1978-02-10", "2026-02-10")).toBe(48);
    expect(ageInYears("2000-02-29", "2025-02-28")).toBe(24);
    expect(ageInYears("2000-02-29", "2025-03-01")).toBe(25);
    expect(ageInYears("1978", "2026-06-01")).toBe(48);
    expect(ageInYears(undefined)).toBeUndefined();
    // Sydney day decides: 14:30 UTC on 9 Feb is 10 Feb in Sydney.
    expect(ageInYears("1978-02-10", new Date("2026-02-09T14:30:00Z"))).toBe(48);
  });
});
