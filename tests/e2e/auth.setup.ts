import { test as setup } from "@playwright/test";

setup("sign in as the demo clinician", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Sign in as demo clinician" }).click();
  await page.waitForURL("**/patients");
  await page.context().storageState({ path: "tests/e2e/.auth.json" });
});
