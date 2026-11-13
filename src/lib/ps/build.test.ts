import type { AllergyIntolerance, Bundle, Composition, Condition, Observation, Patient } from "fhir/r4";
import { describe, expect, it } from "vitest";
import { buildPatientSummary, type Source } from "./build";

const patient: Patient = { resourceType: "Patient", id: "p1", name: [{ family: "Test" }] };
const coding = (system: string, code: string) => ({ coding: [{ system, code }] });
const cond = (id: string, verification: string, clinical = "active"): Condition => ({
  resourceType: "Condition",
  id,
  clinicalStatus: coding("http://terminology.hl7.org/CodeSystem/condition-clinical", clinical),
  verificationStatus: coding("http://terminology.hl7.org/CodeSystem/condition-ver-status", verification),
  code: { text: `Condition ${id}` },
  subject: { reference: "Patient/p1" },
});
const allergy: AllergyIntolerance = {
  resourceType: "AllergyIntolerance",
  id: "a1",
  clinicalStatus: coding("http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical", "active"),
  verificationStatus: coding(
    "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification",
    "confirmed",
  ),
  code: { text: "Penicillin" },
  patient: { reference: "Patient/p1" },
};
const base: Source = {
  patient,
  conditions: [],
  allergies: [],
  medications: [],
  medicationById: new Map(),
  immunizations: [],
  results: [],
  practitioners: [],
};
const sections = (b: Bundle) => (b.entry![0].resource as Composition).section!;
const ids = (b: Bundle) => b.entry!.map((e) => `${e.resource!.resourceType}/${e.resource!.id}`);

describe("AU Patient Summary builder", () => {
  it("author and custodian are in the document and named for the owner", () => {
    const b = buildPatientSummary(base);
    const c = b.entry![0].resource as Composition;
    expect(c.author?.[0].reference).toBe("Practitioner/cliniq-author");
    expect(c.custodian?.reference).toBe("Organization/cliniq-custodian");
    expect(ids(b)).toEqual(
      expect.arrayContaining(["Practitioner/cliniq-author", "Organization/cliniq-custodian"]),
    );
  });

  it("a patient with no allergies gets an empty Allergies section with an empty reason, not a dropped section", () => {
    const allergies = sections(buildPatientSummary(base)).find(
      (s) => s.title === "Allergies and adverse reactions",
    )!;
    expect(allergies.entry).toBeUndefined();
    expect(allergies.emptyReason?.coding?.[0].code).toBe("unavailable");
    expect(allergies.text?.div).toContain("No information about allergies.");
  });

  it("required sections exist even when everything is empty", () => {
    expect(sections(buildPatientSummary(base)).map((s) => s.code?.coding?.[0].code)).toEqual([
      "11450-4",
      "48765-2",
      "10160-0",
    ]);
  });

  it("unconfirmed and resolved conditions are absent from the document", () => {
    const b = buildPatientSummary({
      ...base,
      conditions: [
        cond("c1", "confirmed"),
        cond("c2", "unconfirmed"),
        cond("c3", "provisional"),
        cond("c4", "confirmed", "resolved"),
      ],
    });
    expect(ids(b)).toContain("Condition/c1");
    expect(ids(b)).not.toContain("Condition/c2");
    expect(ids(b)).not.toContain("Condition/c3");
    expect(ids(b)).not.toContain("Condition/c4");
    expect(JSON.stringify(b)).not.toContain("Condition c2");
  });

  it("is a document Bundle that starts with the Composition and keeps only resolvable references", () => {
    const labs: Observation = {
      resourceType: "Observation",
      id: "o1",
      status: "final",
      code: coding("http://loinc.org", "14682-9"),
      subject: { reference: "Patient/p1" },
      encounter: { reference: "Encounter/e1" }, // not in the document, so it is dropped
      effectiveDateTime: "2026-01-01",
      valueQuantity: { value: 90, unit: "umol/L" },
    };
    const b = buildPatientSummary({ ...base, allergies: [allergy], results: [labs] });
    expect(b.type).toBe("document");
    expect(b.entry![0].resource!.resourceType).toBe("Composition");
    const present = new Set(ids(b));
    const refs = [...JSON.stringify(b).matchAll(/"reference":"([^"]+)"/g)].map((m) => m[1]);
    expect(refs.filter((r) => !present.has(r))).toEqual([]);
    expect(sections(b).map((s) => s.title)).toContain("Results");
  });

  it("keeps only the latest result per analyte and escapes narrative text", () => {
    const o = (id: string, date: string, value: number, name: string): Observation => ({
      resourceType: "Observation",
      id,
      status: "final",
      code: { ...coding("http://loinc.org", "14682-9"), text: name },
      subject: { reference: "Patient/p1" },
      effectiveDateTime: date,
      valueQuantity: { value },
    });
    const b = buildPatientSummary({
      ...base,
      results: [o("old", "2025-01-01", 80, "A"), o("new", "2026-01-01", 95, "<b>x</b>")],
    });
    expect(ids(b)).toContain("Observation/new");
    expect(ids(b)).not.toContain("Observation/old");
    const text = sections(b).find((s) => s.title === "Results")!.text!.div;
    expect(text).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(text).not.toContain("<b>");
  });
});
