import { loadEnvFile } from "node:process";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

loadEnvFile(".env.local");
const db = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  });

test("signed out: pages redirect to sign-in, APIs return 401, public routes stay open", async ({
  request,
  page,
}) => {
  await page.goto("/patient/x");
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto("/audit");
  await expect(page).toHaveURL(/\/sign-in$/);
  expect((await request.get("/api/anything")).status()).toBe(401);
  for (const path of ["/api/health", "/cds-services", "/about", "/sign-in"]) {
    expect((await request.get(path)).status(), path).toBe(200);
  }
});

test("security headers: CSP, frame-ancestors, referrer-policy", async ({ request }) => {
  for (const path of ["/sign-in", "/api/health"]) {
    const h = (await request.get(path)).headers();
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["referrer-policy"]).toBe("no-referrer");
  }
});

test("opening a chart writes exactly one audit row with the patient reference", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: "tests/e2e/.auth.json" });
  const page = await ctx.newPage();
  const FHIR = process.env.FHIR_BASE_URL ?? "http://localhost:8080/fhir";
  const id = (
    (await (await fetch(`${FHIR}/Patient?_count=1&_getpagesoffset=19&_sort=family`)).json()) as {
      entry: { resource: { id: string } }[];
    }
  ).entry[0].resource.id;
  const count = async () =>
    (
      await db()
        .from("audit_events")
        .select("id", { count: "exact", head: true })
        .eq("entity", `Patient/${id}`)
        .eq("action", "view")
    ).count ?? 0;
  const before = await count();
  await page.goto(`/patient/${id}`);
  await expect.poll(count).toBe(before + 1);
  await page.waitForTimeout(1500); // a duplicate write would land by now
  expect(await count()).toBe(before + 1);
  await ctx.close();
});

test("the anon key cannot read audit_events", async ({ request }) => {
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const r = await request.get(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/audit_events?select=*`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  expect(await r.json()).toEqual([]);
});

test("POST /api/hl7v2 without a session or key is 401", async ({ request }) => {
  expect((await request.post("/api/hl7v2", { data: "MSH|^~\\&" })).status()).toBe(401);
  expect((await request.post("/api/hl7v2", { data: "x", headers: { "x-api-key": "wrong" } })).status()).toBe(
    401,
  );
});

test("the integration key is accepted for /api/hl7v2 without a session", async ({ request }) => {
  const res = await request.post("/api/hl7v2?dryRun=1", {
    data: "not hl7",
    headers: { "x-api-key": "e2e-integration-key" },
  });
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain("MSA|AR|"); // reached the processor, which rejects the text
});

test("the patient summary download needs a session", async ({ request }) => {
  const res = await request.get("/patient/x/summary.json", { maxRedirects: 0 });
  expect([302, 307, 308]).toContain(res.status());
});
