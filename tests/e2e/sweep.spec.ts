import { expect, test } from "@playwright/test";
import type { Bundle } from "fhir/r4";

const FHIR = process.env.FHIR_BASE_URL ?? "http://localhost:8080/fhir";
const KEY = { "x-api-key": "e2e-integration-key" }; // set for the test server in playwright.config.ts
const TAG = encodeURIComponent("https://github.com/talhatawsif/cliniq/fhir/CodeSystem/tags|care-gap-sweep");
const tasks = async () =>
  (
    (
      (await (
        await fetch(`${FHIR}/Task?_tag=${TAG}&_count=100`, { headers: { "Cache-Control": "no-cache" } })
      ).json()) as Bundle
    ).entry ?? []
  ).length;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const res = await fetch(`${FHIR}/Task?_tag=${TAG}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`cleanup failed: ${res.status}`);
});

test("the sweep creates a Task per open care gap the first time and none the second", async ({ request }) => {
  const first = await request.post("/api/care-gaps/sweep", { headers: KEY });
  expect(first.status()).toBe(200);
  const a = await first.json();
  expect(a.gaps).toBeGreaterThan(0);
  expect(a.created).toBe(a.gaps);
  expect(await tasks()).toBe(a.created);

  const second = await (await request.post("/api/care-gaps/sweep", { headers: KEY })).json();
  expect(second).toMatchObject({ gaps: a.gaps, created: 0, existing: a.gaps });
  expect(await tasks()).toBe(a.created);
});

test("a dry run writes nothing, and the endpoint needs a key or a session", async ({ request, browser }) => {
  const before = await tasks();
  expect((await (await request.post("/api/care-gaps/sweep?dryRun=1", { headers: KEY })).json()).dryRun).toBe(
    true,
  );
  expect(await tasks()).toBe(before);
  const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  expect((await anon.request.post("/api/care-gaps/sweep")).status()).toBe(401);
  expect(
    (await anon.request.post("/api/care-gaps/sweep", { headers: { "x-api-key": "wrong" } })).status(),
  ).toBe(401);
  await anon.close();
});
