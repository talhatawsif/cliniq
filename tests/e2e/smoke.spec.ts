import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import type { Bundle, Patient } from "fhir/r4";

const FHIR = process.env.FHIR_BASE_URL ?? "http://localhost:8080/fhir";
const BANNER =
  /^[A-Z' -]+, .+ · DOB \d{2}\/\d{2}\/\d{4} \((\d+ y|Deceased \d{2}\/\d{2}\/\d{4})\) · \w+ · IHI (\d{4} \d{4} \d{4} \d{4}|not recorded)$/;

async function search<T>(path: string): Promise<T[]> {
  const bundle = (await (await fetch(`${FHIR}/${path}`)).json()) as Bundle;
  return (bundle.entry ?? []).map((e) => e.resource as T);
}
const patientIdWith = async (allergies: boolean) => {
  const withAllergy = new Set(
    (await search<{ patient: { reference: string } }>("AllergyIntolerance?_count=500")).map(
      (a) => a.patient.reference,
    ),
  );
  const all = await search<Patient>("Patient?_count=50");
  return all.find((p) => withAllergy.has(`Patient/${p.id}`) === allergies)?.id;
};
const bannerText = (page: Page) =>
  page
    .getByTestId("banner")
    .innerText()
    .then((t) => t.replace(/\s+/g, " ").trim());

test("banner format, with and without allergies", async ({ page }) => {
  const withId = await patientIdWith(true);
  await page.goto(`/patient/${withId}`);
  expect(await bannerText(page)).toMatch(BANNER);
  await expect(page.getByTestId("banner-allergies")).toContainText("▲ Allergies:");

  const noneId = await patientIdWith(false);
  test.skip(!noneId, "every fixture patient has an allergy record");
  await page.goto(`/patient/${noneId}`);
  await expect(page.getByTestId("banner-allergies")).toContainText("No allergies recorded");
});

test("deceased patient", async ({ page }) => {
  await page.goto("/patients?q=Hoppe");
  await page.getByRole("link", { name: /HOPPE/ }).first().click();
  expect(await bannerText(page)).toMatch(/\(Deceased \d{2}\/\d{2}\/\d{4}\)/);
});

test("worklist, search and empty result", async ({ page }) => {
  await page.goto("/patients");
  await expect(page.getByRole("link", { name: /ABSHIRE/ })).toBeVisible();
  await expect(page.getByText("20 patients · page 1 of 1")).toBeVisible(); // the cohort fits one page
  await expect(page.getByRole("columnheader", { name: "Active problems" })).toBeVisible();
  await expect(page.getByRole("row", { name: /ABSHIRE/ })).toContainText(/\d{2}\/\d{2}\/\d{4}/); // last encounter date
  await page.goto("/patients?q=Zzzz");
  await expect(page.getByText("No patients match that search.")).toBeVisible();
});

test("FHIR JSON drawer opens from every list", async ({ page }) => {
  const id = await patientIdWith(true);
  const lists = [
    [`/patient/${id}`, ["Problems", "Medicines", "Allergies", "Immunisations", "Encounters"]],
    [`/patient/${id}/pathology`, ["All results"]],
    [`/patient/${id}/vitals`, ["All results"]],
  ] as const;
  for (const [url, headings] of lists) {
    await page.goto(url);
    const banner = await bannerText(page);
    for (const h of headings) {
      const region =
        h === "All results" ? page.locator("main") : page.locator(`section:has(> h2:text-is("${h}"))`);
      await region
        .getByRole("button", { name: /View FHIR JSON/ })
        .first()
        .click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("heading")).toHaveText(/^[A-Za-z]+\/[\w.-]+$/);
      await expect(dialog).toContainText(banner.split(" · ")[0]); // wrong-patient guard: banner repeated
      await expect(dialog.locator("pre")).toContainText('"resourceType"');
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
    }
  }
});

test("charts: a blood pressure chart and a table toggle", async ({ page }) => {
  const id = await patientIdWith(true);
  await page.goto(`/patient/${id}/vitals`);
  await expect(page.getByRole("img", { name: /Blood pressure trend/ })).toBeVisible();
  await page.getByRole("button", { name: "Show table" }).first().click();
  await expect(page.getByRole("columnheader", { name: /Value/ }).first()).toBeVisible();
});

test("CDS Hooks: discovery prefetch works against FHIR and returns cards", async ({ request }) => {
  const discovery = await request.get("/cds-services");
  expect(discovery.headers()["access-control-allow-origin"]).toBe("*");
  const { prefetch: templates } = (await discovery.json()).services[0] as {
    prefetch: Record<string, string>;
  };
  const [first] = await search<{ subject: { reference: string } }>("Observation?code=14682-9&_count=1");
  const patientId = first.subject.reference.split("/")[1];
  const prefetch: Record<string, unknown> = {};
  for (const [key, template] of Object.entries(templates)) {
    prefetch[key] = await (
      await fetch(`${FHIR}/${template.replace("{{context.patientId}}", patientId)}`)
    ).json();
  }
  const res = await request.post("/cds-services/cliniq-patient-view", {
    data: { hook: "patient-view", hookInstance: crypto.randomUUID(), context: { patientId }, prefetch },
  });
  expect(res.status()).toBe(200);
  const { cards } = (await res.json()) as { cards: { summary: string }[] };
  expect(cards.some((c) => c.summary.startsWith("eGFR"))).toBe(true);
  expect(
    (
      await request.post("/cds-services/cliniq-patient-view", {
        data: { hook: "patient-view", hookInstance: "x", context: { patientId } },
      })
    ).status(),
  ).toBe(200);
});

test("the chart shows decision support cards", async ({ page }) => {
  const [first] = await search<{ subject: { reference: string } }>("Observation?code=14682-9&_count=1");
  await page.goto(`/patient/${first.subject.reference.split("/")[1]}`);
  await expect(page.getByRole("heading", { name: "Decision support" })).toBeVisible();
  await expect(page.getByText(/eGFR .*CKD-EPI 2021/).first()).toBeVisible();
});

for (const scheme of ["light", "dark"] as const) {
  test.describe(scheme, () => {
    test.use({ colorScheme: scheme });
    const shots = [
      { name: "desktop", size: { width: 1440, height: 900 } },
      { name: "tablet", size: { width: 834, height: 1112 } },
    ];
    for (const { name, size } of shots) {
      test(`screens and axe: ${name}`, async ({ page }) => {
        await page.setViewportSize(size);
        const id = await patientIdWith(true);
        for (const [slug, url] of [
          ["patients", "/patients"],
          ["chart", `/patient/${id}`],
          ["pathology", `/patient/${id}/pathology`],
          ["vitals", `/patient/${id}/vitals`],
        ] as const) {
          await page.goto(url);
          await page.screenshot({ path: `docs/ui/screens/m4/${slug}-${scheme}-${name}.png`, fullPage: true });
          const { violations } = await new AxeBuilder({ page }).analyze();
          const bad = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
          expect(bad.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);
        }
      });
    }
  });
}
