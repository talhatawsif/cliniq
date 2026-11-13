import { loadEnvFile } from "node:process";
import { expect, test } from "@playwright/test";
import { open } from "../../src/lib/smart/seal";

loadEnvFile(".env.local");
const SANDBOX = "https://launch.smarthealthit.org";
const LIVE = Boolean(process.env.APP_URL); // the deployed app has its own SESSION_SECRET, so the cookie cannot be opened here
const APP = process.env.APP_URL ?? "http://localhost:3100";

async function firstId(type: string) {
  const b = (await (await fetch(`${SANDBOX}/v/r4/fhir/${type}?_count=1&_elements=id`)).json()) as {
    entry: { resource: { id: string } }[];
  };
  return b.entry[0].resource.id;
}

test("EHR launch from the SMART sandbox opens the launch patient's chart, read-only", async ({
  page,
  context,
}) => {
  const [patient, provider] = await Promise.all([firstId("Patient"), firstId("Practitioner")]);
  await page.goto(`${SANDBOX}/?launch_url=${encodeURIComponent(`${APP}/smart/launch`)}&fhir_version=r4`);
  await page.locator("#patient").fill(patient);
  await page.locator("#provider").fill(provider);
  // The launcher builds the EHR launch link (iss + launch code) for the app launch URL; follow it as an EHR would.
  await page.goto((await page.locator("#ehr-launch-url").getAttribute("href"))!);

  await page.waitForURL(`**/patient/${patient}`, { timeout: 30_000 }).catch(async (e) => {
    console.log("STUCK AT", page.url(), (await page.locator("body").innerText()).slice(0, 600));
    throw e;
  });
  const banner = page.getByTestId("smart-banner");
  await expect(banner).toContainText("SMART mode, read-only");
  await expect(banner).toContainText("launch.smarthealthit.org");
  await expect(page.getByTestId("banner")).toBeVisible(); // the patient banner, from the sandbox's data
  await page.screenshot({ path: "docs/ui/screens/m12/smart-chart.png", fullPage: true });

  // The token is only in an httpOnly cookie, sealed; never in the page.
  const cookie = (await context.cookies()).find((c) => c.name === "smart_session")!;
  expect(cookie.httpOnly).toBe(true);
  if (!LIVE) {
    const session = open<{ token: string; patient: string }>(
      cookie.value,
      process.env.SESSION_SECRET!,
      "session",
    )!;
    expect(session.patient).toBe(patient);
    expect(cookie.value).not.toContain(session.token);
    expect(await page.content()).not.toContain(session.token);
    const rsc = await (await context.request.get(`/patient/${patient}`, { headers: { RSC: "1" } })).text();
    expect(rsc).not.toContain(session.token);
  }
  expect(cookie.value).not.toMatch(/eyJ/); // not a readable JWT

  // Other patients are not reachable; the worklist goes back to the launch patient.
  const other = await context.request.get("/patient/some-other-patient", { maxRedirects: 0 });
  expect(other.status()).toBe(307); // not the launch patient: no access without a demo sign-in
  expect(other.headers().location).toContain("/sign-in");
  await page.goto("/patients");
  await expect(page).toHaveURL(new RegExp(`/patient/${patient}$`));

  // Every write endpoint is refused with 403 smart-read-only.
  const writes = [
    context.request.post("/api/hl7v2", { data: "MSH|^~\\&|a|b|c|d|20260101||ORU^R01|X1|P|2.4" }),
    context.request.post("/pipeline", { data: "x" }),
    context.request.post("/review", { data: "x" }),
    context.request.post("/hl7", { data: "x" }),
    context.request.post("/api/anything", { data: "x" }),
    context.request.put(`/patient/${patient}`, { data: "x" }),
    context.request.delete(`/patient/${patient}`),
  ];
  for (const res of await Promise.all(writes)) {
    expect(res.status()).toBe(403);
    expect((await res.json()).error).toBe("smart-read-only");
  }

  // Leaving SMART mode clears the cookie.
  await page.getByRole("button", { name: "Exit SMART mode" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  expect((await context.cookies()).some((c) => c.name === "smart_session")).toBe(false);
});

test("a callback with a wrong state is rejected", async ({ page, request }) => {
  await page.goto("/smart/launch"); // stores the transaction cookie, then redirects to the sandbox
  await page.waitForURL(/launch\.smarthealthit\.org/);
  const res = await page.goto("/smart/callback?code=abc&state=wrong"); // a browser navigation sends the cookie
  expect(res!.status()).toBe(400);
  await expect(page.locator("body")).toContainText("State mismatch");
  expect((await request.get("/smart/callback?code=abc&state=x")).status()).toBe(400); // no launch in progress
});

test("an issuer other than the sandbox is refused", async ({ request }) => {
  const res = await request.get("/smart/launch?iss=" + encodeURIComponent("https://evil.example/fhir"), {
    maxRedirects: 0,
  });
  expect(res.status()).toBe(400);
});

test("standalone launch: provider login, patient picker, then the chart", async ({ page }) => {
  await page.goto("/smart/launch");
  await page.locator("select").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Login" }).click();
  await page.waitForURL(/select-patient/);
  await page.locator("tr[title^='Click to select patient']").first().click();
  await page.getByRole("button", { name: "Approve" }).click(); // the consent page
  await page.waitForURL(/\/patient\/[\w-]+$/, { timeout: 30_000 }).catch(async (e) => {
    console.log("STUCK AT", page.url().slice(0, 200), (await page.locator("body").innerText()).slice(0, 500));
    throw e;
  });
  await expect(page.getByTestId("smart-banner")).toContainText("SMART mode, read-only");
  await expect(page.getByTestId("banner")).toBeVisible();
  await page.screenshot({ path: "docs/ui/screens/m12/smart-standalone-chart.png", fullPage: true });
});
