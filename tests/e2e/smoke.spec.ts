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
  await page.goto("/patients?q=Zzzz");
  await expect(page.getByText("No patients match that search.")).toBeVisible();
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
        ] as const) {
          await page.goto(url);
          await page.screenshot({ path: `docs/ui/screens/m3/${slug}-${scheme}-${name}.png`, fullPage: true });
          const { violations } = await new AxeBuilder({ page }).analyze();
          const bad = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
          expect(bad.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);
        }
      });
    }
  });
}
