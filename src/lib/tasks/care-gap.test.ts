import type { Condition, Observation, Task } from "fhir/r4";
import { describe, expect, it } from "vitest";
import { careGaps, type Inputs } from "../cds/rules";
import { buildGapTask, countResponses, gapBundle, gapKey } from "./care-gap";

const NOW = new Date("2026-11-14T00:00:00Z");
const cond = (code: string): Condition => ({
  resourceType: "Condition",
  subject: { reference: "Patient/p1" },
  clinicalStatus: { coding: [{ code: "active" }] },
  verificationStatus: { coding: [{ code: "confirmed" }] },
  code: { coding: [{ system: "http://snomed.info/sct", code }] },
});
const obs = (date: string): Observation => ({
  resourceType: "Observation",
  status: "final",
  code: { text: "x" },
  effectiveDateTime: date,
});
const inputs = (over: Partial<Inputs>): Inputs => ({
  patient: { resourceType: "Patient", id: "p1", gender: "male", birthDate: "1960-01-01" },
  conditions: [],
  creatinine: [],
  weight: [],
  height: [],
  hba1c: [],
  bp: [],
  ...over,
});

describe("care gaps", () => {
  it("diabetes without an HbA1c in 12 months, and hypertension without a blood pressure, are gaps", () => {
    const gaps = careGaps(inputs({ conditions: [cond("44054006"), cond("38341003")] }), NOW);
    expect(gaps.map((g) => g.type)).toEqual(["diabetes-hba1c", "hypertension-bp"]);
  });
  it("a recent result closes the gap", () => {
    expect(careGaps(inputs({ conditions: [cond("44054006")], hba1c: [obs("2026-06-01")] }), NOW)).toEqual([]);
  });
});

describe("gap Task", () => {
  const [gap] = careGaps(inputs({ conditions: [cond("44054006")] }), NOW);
  it("is a requested Task for the patient, created conditionally on a stable identifier", () => {
    const e = buildGapTask("p1", gap, NOW);
    const t = e.resource as Task;
    expect(t).toMatchObject({
      status: "requested",
      intent: "order",
      for: { reference: "Patient/p1" },
      identifier: [{ value: gapKey("p1", "diabetes-hba1c") }],
    });
    expect(e.request).toMatchObject({ method: "POST", url: "Task" });
    expect(e.request!.ifNoneExist).toContain(
      "identifier=http://cliniq.example/fhir/identifier/care-gap|p1%7Cdiabetes-hba1c",
    );
    // a later sweep builds the same condition, so nothing new is created
    expect(buildGapTask("p1", gap, new Date("2027-01-01")).request!.ifNoneExist).toBe(e.request!.ifNoneExist);
    expect(gapBundle([e]).type).toBe("transaction");
  });
  it("counts created and existing entries from a transaction response", () => {
    expect(
      countResponses({
        resourceType: "Bundle",
        type: "transaction-response",
        entry: [
          { response: { status: "201 Created" } },
          { response: { status: "200 OK" } },
          { response: { status: "200 OK" } },
        ],
      }),
    ).toEqual({ created: 1, existing: 2 });
  });
});
