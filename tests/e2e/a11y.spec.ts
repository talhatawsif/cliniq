import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const FHIR = process.env.FHIR_BASE_URL ?? "http://localhost:8080/fhir";
const firstPatient = async () =>
  (
    (await (await fetch(`${FHIR}/Patient?_count=1&_sort=family`)).json()) as {
      entry: { resource: { id: string } }[];
    }
  ).entry[0].resource.id;

// Every page, both themes, desktop and tablet: no serious or critical axe violations.
for (const scheme of ["light", "dark"] as const) {
  test.describe(`axe on every page (${scheme})`, () => {
    test.use({ colorScheme: scheme });
    for (const size of [
      { name: "desktop", width: 1440, height: 900 },
      { name: "tablet", width: 834, height: 1112 },
    ]) {
      test(size.name, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        const id = await firstPatient();
        const paths = [
          "/about",
          "/patients",
          "/audit",
          "/hl7",
          "/pipeline",
          "/review",
          `/patient/${id}`,
          `/patient/${id}/pathology`,
          `/patient/${id}/vitals`,
          `/patient/${id}/summary`,
        ];
        const bad: string[] = [];
        for (const path of paths) {
          await page.goto(path);
          const { violations } = await new AxeBuilder({ page }).analyze();
          for (const v of violations.filter((v) => v.impact === "serious" || v.impact === "critical"))
            bad.push(`${path} ${v.id}: ${v.nodes[0]?.html.slice(0, 120)}`);
        }
        // The sign-in page is only shown to someone signed out.
        await page.context().clearCookies();
        await page.goto("/sign-in");
        for (const v of (await new AxeBuilder({ page }).analyze()).violations.filter(
          (v) => v.impact === "serious" || v.impact === "critical",
        )) {
          bad.push(`/sign-in ${v.id}: ${v.nodes[0]?.html.slice(0, 120)}`);
        }
        expect(bad).toEqual([]);
      });
    }
  });
}
