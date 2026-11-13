import { expect, test } from "@playwright/test";

// The public CDS Hooks sandbox calls the deployed service with its own patient's prefetch. Run on demand:
//   npx playwright test -c playwright.sandbox.config.ts
const SERVICE = process.env.CDS_URL ?? "https://cliniq-inky-ten.vercel.app/cds-services";

test("the CDS Hooks sandbox discovers ClinIQ's service and shows its cards", async ({ page }) => {
  await page.goto("https://sandbox.cds-hooks.org");
  await page.waitForLoadState("networkidle");
  await page.locator("button.MuiIconButton-root").nth(1).click(); // the settings menu
  await page.getByText("Add CDS Services").click();
  await page.locator("input").last().fill(SERVICE);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("cliniq-patient-view").first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Source: ClinIQ decision support (demo)").first()).toBeVisible({
    timeout: 60_000,
  });
  await page.screenshot({ path: "docs/ui/screens/m5/sandbox.png" });
});
