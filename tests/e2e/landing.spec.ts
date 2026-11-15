import { expect, test } from "@playwright/test";

test("a signed-in visitor skips the landing page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/patients$/);
});
