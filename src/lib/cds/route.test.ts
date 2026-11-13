import { describe, expect, it } from "vitest";
import { GET } from "@/app/cds-services/route";
import { POST } from "@/app/cds-services/cliniq-patient-view/route";

const post = (body: unknown) =>
  POST(
    new Request("http://x/cds-services/cliniq-patient-view", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
const base = {
  hook: "patient-view",
  hookInstance: "11111111-1111-1111-1111-111111111111",
  context: { patientId: "p1", userId: "Practitioner/1" },
};

describe("CDS Hooks service", () => {
  it("lists the service with prefetch templates, CORS open", async () => {
    const res = GET();
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    const { services } = await res.json();
    expect(services[0]).toMatchObject({ hook: "patient-view", id: "cliniq-patient-view" });
    expect(services[0].prefetch.patient).toBe("Patient/{{context.patientId}}");
  });
  it("a request without prefetch returns 200 and no cards", async () => {
    const res = await post(base);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ cards: [] });
  });
  it("ignores the fhirServer in the request", async () => {
    const res = await post({ ...base, fhirServer: "http://169.254.169.254/" });
    expect(await res.json()).toEqual({ cards: [] });
  });
  it("returns cards from prefetch", async () => {
    const res = await post({
      ...base,
      prefetch: {
        patient: { resourceType: "Patient", gender: "male", birthDate: "1950-01-01" },
        creatinine: {
          resourceType: "Bundle",
          entry: [
            {
              resource: {
                resourceType: "Observation",
                status: "final",
                code: { coding: [{ code: "2160-0" }] },
                effectiveDateTime: new Date().toISOString(),
                valueQuantity: { value: 2.0, code: "mg/dL" },
              },
            },
          ],
        },
      },
    });
    const { cards } = await res.json();
    expect(cards[0].summary).toContain("eGFR");
  });
  it("rejects malformed bodies", async () => {
    expect((await post("not json")).status).toBe(400);
    expect((await post({ hook: "order-sign" })).status).toBe(400);
  });
});
