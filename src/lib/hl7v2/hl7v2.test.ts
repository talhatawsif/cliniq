import { readFileSync } from "node:fs";
import type { DiagnosticReport, Observation } from "fhir/r4";
import { describe, expect, it } from "vitest";
import { type Deps, processMessage } from "./process";
import { hl7Time, ihiOf, mapOru, patientQuery, referenceRange } from "./map";
import { parseMessage } from "./parse";

const REF = readFileSync("data/hl7v2/oru-creatinine.hl7", "utf8");
const IHI = "8003608833357361";
const obs = (text: string, pid = "p1") =>
  mapOru(parseMessage(text), pid)
    .entry!.map((e) => e.resource!)
    .filter((r): r is Observation => r.resourceType === "Observation");
const withObx = (obx: string) => REF.split("\r")[0] + "\r" + REF.split("\r")[2] + "\r" + obx + "\r";

function fakes(over: Partial<Deps> = {}) {
  const log: Parameters<Deps["log"]>[0][] = [];
  const written: unknown[] = [];
  const deps: Deps = {
    findPatientIds: async () => ["p1"],
    validate: async () => [],
    write: async (b) => void written.push(b),
    alreadyAccepted: async (id) => log.some((l) => l.controlId === id && l.status === "accepted"),
    log: async (row) => void log.push(row),
    ...over,
  };
  return { deps, log, written };
}

describe("HL7 v2 to FHIR (H1-H16)", () => {
  it("H1 looks the patient up by IHI (NI identifier)", () => {
    expect(ihiOf(parseMessage(REF))).toBe(IHI);
    expect(patientQuery(IHI)).toBe(
      `Patient?identifier=http://ns.electronichealth.net.au/id/hi/ihi/1.0|${IHI}`,
    );
    expect(mapOru(parseMessage(REF), "p1").entry![0].resource).toMatchObject({
      subject: { reference: "Patient/p1" },
    });
  });

  it("H3 DiagnosticReport", () => {
    const bundle = mapOru(parseMessage(REF), "p1");
    const dr = bundle.entry![0].resource as DiagnosticReport;
    expect(dr).toMatchObject({
      status: "final",
      category: [{ coding: [{ code: "LAB" }] }],
      code: { coding: [{ system: "http://loinc.org", code: "24323-8" }] },
      identifier: [{ value: "LAB0001" }],
      effectiveDateTime: "2026-11-10T08:15:00+10:00",
      issued: "2026-11-10T09:20:00+10:00",
    });
    expect(dr.result).toHaveLength(3);
  });

  it("H4 OBX 1 numeric result", () => {
    expect(obs(REF)[0]).toMatchObject({
      status: "final",
      category: [{ coding: [{ code: "laboratory" }] }],
      code: { coding: [{ system: "http://loinc.org", code: "14682-9" }] },
      valueQuantity: { value: 132, unit: "umol/L", system: "http://unitsofmeasure.org", code: "umol/L" },
      referenceRange: [{ low: { value: 45 }, high: { value: 90 } }],
      interpretation: [
        {
          coding: [
            { system: "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation", code: "H" },
          ],
        },
      ],
      effectiveDateTime: "2026-11-10T08:15:00+10:00",
    });
  });

  it("H5 effective falls back to OBR-7; NTE becomes a note", () => {
    expect(obs(REF)[1].effectiveDateTime).toBe("2026-11-10T08:15:00+10:00");
    expect(obs(REF)[1].note).toEqual([{ text: "Sample slightly haemolysed." }]);
  });

  it("H6 ST value with an escape", () => expect(obs(REF)[2].valueString).toBe("Pale & clear"));

  it("H7 timestamps keep precision; no offset uses MSH-7's", () => {
    expect(hl7Time("20261110")).toBe("2026-11-10");
    expect(hl7Time("202611")).toBe("2026-11");
    expect(hl7Time("20261110081500", "+1000")).toBe("2026-11-10T08:15:00+10:00");
    expect(hl7Time("20261110081500")).toBe("2026-11-10"); // no offset known anywhere: date only
    expect(hl7Time("nonsense")).toBeUndefined();
  });

  it("H8 reference ranges", () => {
    expect(referenceRange("<5.0", [])).toEqual([{ high: { value: 5 } }]);
    expect(referenceRange(">3", [])).toEqual([{ low: { value: 3 } }]);
    expect(referenceRange("see note", [])).toEqual([{ text: "see note" }]);
  });

  it("H9 SN comparator", () => {
    const o = obs(withObx("OBX|3|SN|14682-9^Creatinine^LN||<^5|umol/L^umol/L^UCUM|||||F"))[0];
    expect(o.valueQuantity).toMatchObject({ value: 5, comparator: "<" });
  });

  it("H10 result status P and C", () => {
    expect(obs(withObx("OBX|1|NM|14682-9^C^LN||1||||||P"))[0].status).toBe("preliminary");
    expect(obs(withObx("OBX|1|NM|14682-9^C^LN||1||||||C"))[0].status).toBe("corrected");
  });

  it("H15 line endings", () => {
    const lf = parseMessage(REF.replace(/\r/g, "\n"));
    const crlf = parseMessage(REF.replace(/\r/g, "\r\n"));
    expect(lf.segments).toEqual(parseMessage(REF).segments);
    expect(crlf.segments).toEqual(parseMessage(REF).segments);
  });

  it("H12 a correction maps to the same resource ids", () => {
    const corrected = REF.replace("|F|||20261110081500+1000", "|C|||20261110081500+1000");
    expect(obs(corrected)[0].id).toBe(obs(REF)[0].id);
    expect(obs(corrected)[0].status).toBe("corrected");
    expect(new Set(obs(REF).map((o) => o.id)).size).toBe(3);
  });

  it("H14 success ACK", async () => {
    const { deps, written } = fakes();
    const r = await processMessage(REF, deps, { now: new Date("2026-11-10T00:00:00Z") });
    const [msh, msa] = r.ack.split("\r");
    expect(msh).toBe("MSH|^~\\&|CLINIQ|CLINIQ|LABSYS|PATHLAB|20261110000000||ACK^R01|ACKMSG00001|P|2.4");
    expect(msa).toBe("MSA|AA|MSG00001|Written");
    expect(written).toHaveLength(1);
  });

  it("H2 no or several matching patients: AE, nothing written, stored as failed", async () => {
    for (const ids of [[], ["a", "b"]]) {
      const { deps, log, written } = fakes({ findPatientIds: async () => ids });
      const r = await processMessage(REF, deps);
      expect(r.ack).toContain("MSA|AE|MSG00001");
      expect(written).toHaveLength(0);
      expect(log[0].status).toBe("failed");
    }
  });

  it("H11 the same control id twice: second is AA and writes nothing", async () => {
    const { deps, written } = fakes();
    await processMessage(REF, deps);
    const second = await processMessage(REF, deps);
    expect(second.ack).toContain("MSA|AA|MSG00001");
    expect(second.status).toBe("duplicate");
    expect(written).toHaveLength(1);
  });

  it("H13 ADT^A01 is rejected", async () => {
    const { deps, written } = fakes();
    const r = await processMessage(REF.replace("ORU^R01", "ADT^A01"), deps);
    expect(r.ack).toContain("MSA|AR|MSG00001|Unsupported message type ADT\\S\\A01");
    expect(r.ack).toContain("ACK^A01");
    expect(written).toHaveLength(0);
  });

  it("H16 validation errors give AE and write nothing; dry run writes nothing", async () => {
    const bad = fakes({ validate: async () => ["Observation.code: bad"] });
    expect((await processMessage(REF, bad.deps)).ack).toContain("MSA|AE|MSG00001");
    expect(bad.written).toHaveLength(0);
    const dry = fakes();
    const r = await processMessage(REF, dry.deps, { dryRun: true });
    expect(r.status).toBe("dry-run");
    expect(dry.written).toHaveLength(0);
    expect(dry.log).toHaveLength(0);
  });

  it("garbage input gets AR, not an exception", async () => {
    const r = await processMessage("hello", fakes().deps);
    expect(r.ack).toContain("MSA|AR||");
  });

  it("wrong-patient guards: ids are scoped to patient and sender, IHI must be 16 digits, DOB must agree", async () => {
    // The same filler number for another patient, or from another lab, never maps onto the same resources.
    const ids = (text: string, pid: string) =>
      mapOru(parseMessage(text), pid).entry!.map((e) => e.resource!.id);
    expect(ids(REF, "p1")).toEqual(ids(REF, "p1"));
    expect(ids(REF, "p2").some((id) => ids(REF, "p1").includes(id))).toBe(false);
    expect(
      ids(REF.replace("|LABSYS|PATHLAB|", "|LABSYS|OTHERLAB|"), "p1").some((id) =>
        ids(REF, "p1").includes(id),
      ),
    ).toBe(false);

    // An IHI field that is not exactly 16 digits is not an IHI (it would otherwise reach the FHIR search as written).
    expect(ihiOf(parseMessage(REF.replace(IHI, `${IHI},http://x\\F\\1`)))).toBeUndefined();
    expect(ihiOf(parseMessage(REF.replace(IHI, "800360883335736")))).toBeUndefined();

    // PID-7 is 19700101 in the reference message.
    const mismatch = fakes({ birthDateOf: async () => "1980-05-05" });
    const r = await processMessage(REF, mismatch.deps);
    expect(r.ack).toContain("MSA|AE|MSG00001|Date of birth");
    expect(mismatch.written).toHaveLength(0);
    const same = fakes({ birthDateOf: async () => "1970-01-01" });
    expect((await processMessage(REF, same.deps)).code).toBe("AA");
  });

  it("the same test twice in one message gets two resources, not a clash", () => {
    const twice =
      REF.replace(/\r$/, "") + "\rOBX|4|NM|14682-9^Creatinine^LN||140|umol/L^umol/L^UCUM|45-90|H|||F\r";
    const all = obs(twice);
    expect(all).toHaveLength(4);
    expect(new Set(all.map((o) => o.id)).size).toBe(4);
    expect(all[0].id).toBe(obs(REF)[0].id); // the first keeps its id, so a correction still finds it
  });
});
