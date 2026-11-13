import { expect, test } from "@playwright/test";

// Exploratory: every patient x every page, odd inputs, looking for 500s, error pages and slow responses.
const FHIR = process.env.FHIR_BASE_URL ?? "http://localhost:8080/fhir";
const ids = async () =>
  (
    (await (await fetch(`${FHIR}/Patient?_count=50`)).json()) as { entry: { resource: { id: string } }[] }
  ).entry.map((e) => e.resource.id);

test("every patient page responds without a server error", async ({ browser }) => {
  const ctx = await browser.newContext({
    storageState: "tests/e2e/.auth.json",
    baseURL: "http://localhost:3100",
  });
  const bad: string[] = [];
  for (const id of await ids()) {
    for (const path of ["", "/pathology", "/vitals", "/summary", "/summary.json"]) {
      const t0 = Date.now();
      const res = await ctx.request.get(`/patient/${id}${path}`);
      const body = await res.text();
      if (res.status() !== 200 || /Application error|Internal Server Error|digest/.test(body.slice(0, 4000)))
        bad.push(`${path || "/"} ${id} ${res.status()}`);
      if (Date.now() - t0 > 5000) bad.push(`SLOW ${path} ${id} ${Date.now() - t0} ms`);
    }
  }
  expect(bad).toEqual([]);
});

test("odd inputs do not crash", async ({ browser }) => {
  const ctx = await browser.newContext({
    storageState: "tests/e2e/.auth.json",
    baseURL: "http://localhost:3100",
  });
  const urls = [
    "/patients?page=-5",
    "/patients?page=abc",
    "/patients?page=99999999999",
    "/patients?q=%00",
    "/patients?q=" + "x".repeat(5000),
    "/patients?q=O'Brien",
    "/patients?q=%3Cscript%3E",
    "/patients?q=8003608166980383",
    "/patients?q=8003%206081%206698%200383",
    "/patients?q=a&q=b",
    "/audit?action=bogus",
    "/audit?outcome=bogus",
    "/audit?entity=" + "y".repeat(500),
    "/audit?action=view&action=write",
    "/patient/%00",
    "/patient/..%2F..",
    "/patient/x%26_include%3D*",
    "/patient/" + "a".repeat(200),
    "/patient/nonexistent/pathology",
    "/patient/nonexistent/summary",
    "/review",
    "/hl7",
    "/pipeline",
    "/api/health?deep=1",
    "/api/health?deep=x",
    "/smart/launch?iss=",
    "/smart/callback",
    "/cds-services",
  ];
  const bad: string[] = [];
  for (const u of urls) {
    const res = await ctx.request.get(u, { maxRedirects: 0 });
    if (res.status() >= 500) bad.push(`${u.slice(0, 60)} -> ${res.status()}`);
  }
  expect(bad).toEqual([]);
});

test("odd POSTs do not crash", async ({ browser }) => {
  const ctx = await browser.newContext({
    storageState: "tests/e2e/.auth.json",
    baseURL: "http://localhost:3100",
  });
  const id = (await ids())[0];
  const posts: [string, object][] = [
    ["/api/hl7v2", { data: "" }],
    ["/api/hl7v2", { data: "MSH" }],
    ["/api/hl7v2", { data: "MSH|^~\\&|a|b|c|d|20260101||ORU^R01|X|P|2.4\rOBR|1\r" }],
    ["/api/hl7v2", { data: "\u0000\u0001garbage" }],
    ["/api/hl7v2?dryRun=2", { data: "x" }],
    [`/api/patients/${id}/assistant`, { data: "not json", headers: { "content-type": "application/json" } }],
    [`/api/patients/${id}/assistant`, { data: { question: "x".repeat(501) } }],
    [`/api/patients/${id}/assistant`, { data: { question: 5 } }],
    ["/api/patients/nonexistent/assistant", { data: { question: "Allergies?" } }],
    ["/cds-services/cliniq-patient-view", { data: "{}" }],
    ["/cds-services/cliniq-patient-view", { data: "[]" }],
    [
      "/cds-services/cliniq-patient-view",
      {
        data: {
          hook: "patient-view",
          hookInstance: "a",
          context: { patientId: "p" },
          prefetch: { patient: "str", conditions: 5, creatinine: [1, 2] },
        },
      },
    ],
    [
      "/cds-services/cliniq-patient-view",
      {
        data: {
          hook: "patient-view",
          hookInstance: "a",
          context: { patientId: "p" },
          prefetch: { patient: { resourceType: "Patient" } },
        },
      },
    ],
    [
      "/cds-services/cliniq-patient-view",
      {
        data: {
          hook: "patient-view",
          hookInstance: "a",
          context: { patientId: "p" },
          prefetch: {
            patient: { resourceType: "Patient", birthDate: "bad", gender: "male" },
            creatinine: {
              resourceType: "Bundle",
              entry: [
                {
                  resource: {
                    resourceType: "Observation",
                    status: "final",
                    code: { coding: [{ code: "2160-0" }] },
                    valueQuantity: { value: "abc", unit: "mg/dL" },
                    effectiveDateTime: "nope",
                  },
                },
              ],
            },
          },
        },
      },
    ],
    ["/api/care-gaps/sweep?dryRun=9", {}],
  ];
  const bad: string[] = [];
  for (const [u, opts] of posts) {
    const res = await ctx.request.post(u, opts as never);
    if (res.status() >= 500) bad.push(`${u} -> ${res.status()} ${(await res.text()).slice(0, 100)}`);
  }
  expect(bad).toEqual([]);
});
