import type { Bundle, Condition, Device, Provenance } from "fhir/r4";
import { describe, expect, it } from "vitest";
import { buildPatientSummary } from "../ps/build";
import { evaluate } from "../cds/rules";
import { buildDecision, buildFinding, buildNote, findingKey, reasonNotWritten } from "./build";

const NOW = new Date("2026-11-14T00:00:00Z");
const finding = {
  patientId: "p1",
  docId: "sample-01",
  text: "T2DM",
  coding: { code: "44054006", display: "Type 2 diabetes" },
};
const tool = { version: "medspacy; SNOMED CT-AU 20261031 (offline)" };
const of = <T>(b: Bundle, type: string) =>
  b.entry!.map((e) => e.resource!).filter((r) => r.resourceType === type) as T[];
const condition = () => of<Condition>(buildFinding(finding, tool, NOW), "Condition")[0];

describe("W1-W3: a new finding", () => {
  const bundle = buildFinding(finding, tool, NOW);

  it("W1 is one transaction with a Condition and a Provenance", () => {
    expect(bundle.type).toBe("transaction");
    expect(of(bundle, "Condition")).toHaveLength(1);
    expect(of(bundle, "Provenance")).toHaveLength(1);
  });

  it("W2 the Condition is unconfirmed, active, auto-extracted and cites the note", () => {
    const c = condition();
    expect(c.verificationStatus?.coding?.[0]).toEqual({
      system: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
      code: "unconfirmed",
    });
    expect(c.clinicalStatus?.coding?.[0].code).toBe("active");
    expect(c.category?.[0].coding?.[0].code).toBe("encounter-diagnosis");
    expect(c.code?.coding?.[0]).toMatchObject({ system: "http://snomed.info/sct", code: "44054006" });
    expect(c.code?.text).toBe("T2DM");
    expect(c.subject.reference).toBe("Patient/p1");
    expect(c.recordedDate).toBe(NOW.toISOString());
    expect(c.evidence?.[0].detail?.[0].reference).toBe("DocumentReference/sample-01");
    expect(c.meta?.tag?.map((t) => t.code)).toContain("auto-extracted");
    expect((c as { asserter?: unknown }).asserter).toBeUndefined();
  });

  it("W3 the Provenance records CREATE by the pipeline Device from the note", () => {
    const p = of<Provenance>(bundle, "Provenance")[0];
    const conditionUrl = bundle.entry!.find((e) => e.resource?.resourceType === "Condition")!.fullUrl;
    const deviceUrl = bundle.entry!.find((e) => e.resource?.resourceType === "Device")!.fullUrl;
    expect(p.target[0].reference).toBe(conditionUrl);
    expect(p.recorded).toBe(NOW.toISOString());
    expect(p.activity?.coding?.[0]).toMatchObject({
      system: "http://terminology.hl7.org/CodeSystem/v3-DataOperation",
      code: "CREATE",
    });
    expect(p.agent[0].type?.coding?.[0].code).toBe("assembler");
    expect(p.agent[0].who.reference).toBe(deviceUrl);
    expect(p.entity?.[0]).toMatchObject({
      role: "source",
      what: { reference: "DocumentReference/sample-01" },
    });
    const device = of<Device>(bundle, "Device")[0];
    expect(device.deviceName?.[0].name).toBe("ClinIQ coding pipeline");
    expect(device.version?.[0].value).toBe(tool.version);
  });
});

describe("W5: reruns", () => {
  it("the same note and code give the same conditional-create identifier; another code does not", () => {
    const ifNone = (b: Bundle) =>
      b.entry!.find((e) => e.resource?.resourceType === "Condition")!.request!.ifNoneExist;
    expect(ifNone(buildFinding(finding, tool, NOW))).toBe(
      ifNone(buildFinding(finding, tool, new Date("2027-01-01"))),
    );
    expect(
      ifNone(buildFinding({ ...finding, coding: { code: "38341003", display: "Hypertension" } }, tool, NOW)),
    ).not.toBe(ifNone(buildFinding(finding, tool, NOW)));
    expect(findingKey("a", "1")).toBe(findingKey("a", "1"));
    expect(ifNone(buildFinding(finding, tool, NOW))).toContain(
      "identifier=http://cliniq.example/fhir/identifier/auto-finding|",
    );
  });
});

describe("W6: which entities are written", () => {
  const base = { negated: false, family: false, historical: false, hypothetical: false, uncertain: false };
  it.each(["negated", "family", "hypothetical", "uncertain", "historical"] as const)(
    "%s is never written and has a reason",
    (flag) => {
      expect(reasonNotWritten({ ...base, [flag]: true })).toBeTruthy();
    },
  );
  it("affirmed is written", () => expect(reasonNotWritten(base)).toBeNull());
});

describe("W7-W9: reviewer decisions", () => {
  const stored: Condition = { ...condition(), id: "c1", meta: { versionId: "1" } };
  const ver = (b: Bundle) => of<Condition>(b, "Condition")[0];
  const prov = (b: Bundle) => of<Provenance>(b, "Provenance")[0];

  it("W7 confirm: confirmed, and an UPDATE Provenance with the verifier", () => {
    const b = buildDecision(stored, "confirm", NOW);
    expect(ver(b).verificationStatus?.coding?.[0].code).toBe("confirmed");
    expect(prov(b).activity?.coding?.[0].code).toBe("UPDATE");
    expect(prov(b).agent[0].type?.coding?.[0].code).toBe("verifier");
    const practitioner = b.entry!.find((e) => e.resource?.resourceType === "Practitioner")!;
    expect(prov(b).agent[0].who.reference).toBe(practitioner.fullUrl);
    expect(b.entry!.find((e) => e.request?.method === "PUT")!.request!.ifMatch).toBe('W/"1"');
  });

  it("W8 change code: the reviewer's code replaces it and is confirmed; the Provenance says what changed", () => {
    const b = buildDecision(stored, "change", NOW, { code: "46635009", display: "Type 1 diabetes" });
    expect(ver(b).code?.coding?.[0].code).toBe("46635009");
    expect(ver(b).verificationStatus?.coding?.[0].code).toBe("confirmed");
    expect(prov(b).reason?.[0].text).toContain("44054006");
    expect(prov(b).reason?.[0].text).toContain("46635009");
    expect(() => buildDecision(stored, "change", NOW)).toThrow();
  });

  it("W9 reject: refuted and inactive", () => {
    const c = ver(buildDecision(stored, "reject", NOW));
    expect(c.verificationStatus?.coding?.[0].code).toBe("refuted");
    expect(c.clinicalStatus?.coding?.[0].code).toBe("inactive");
  });

  it("does not change the stored Condition object", () => {
    buildDecision(stored, "reject", NOW);
    expect(stored.verificationStatus?.coding?.[0].code).toBe("unconfirmed");
  });
});

describe("W11: an unconfirmed finding does not leak", () => {
  const unconfirmed: Condition = { ...condition(), id: "c1" };
  it("produces no CDS care-gap card, while the same finding confirmed does", () => {
    const run = (conditions: Condition[]) =>
      evaluate(
        {
          patient: { resourceType: "Patient", id: "p1", gender: "female", birthDate: "1960-01-01" },
          conditions,
          creatinine: [],
          weight: [],
          height: [],
          hba1c: [],
          bp: [],
        },
        NOW,
      ).some((c) => c.summary.startsWith("Diabetes"));
    const confirmed = buildDecision({ ...unconfirmed, meta: { versionId: "1" } }, "confirm", NOW).entry![1]
      .resource as Condition;
    expect(run([unconfirmed])).toBe(false);
    expect(run([confirmed])).toBe(true);
  });
  it("is absent from the AU patient summary", () => {
    const b = buildPatientSummary({
      patient: { resourceType: "Patient", id: "p1" },
      conditions: [unconfirmed],
      allergies: [],
      medications: [],
      medicationById: new Map(),
      immunizations: [],
      results: [],
      practitioners: [],
    });
    expect(JSON.stringify(b)).not.toContain("44054006");
  });
});

describe("pasted notes", () => {
  it("get a stable id from patient and text, and keep the text", () => {
    const a = buildNote("p1", "hello", NOW);
    expect(a.id).toBe(buildNote("p1", "hello", new Date("2030-01-01")).id);
    expect(a.id).not.toBe(buildNote("p1", "hello!", NOW).id);
    expect(Buffer.from(a.content[0].attachment!.data!, "base64").toString()).toBe("hello");
  });
});
