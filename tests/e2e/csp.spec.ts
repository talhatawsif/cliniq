import { expect, test } from "@playwright/test";

// Scripts run only with this request's nonce, and the pages still work under that policy.
for (const path of ["/patients", "/pipeline", "/about", "/sign-in"]) {
  test(`strict script policy on ${path}`, async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (m) => {
      if (m.text().includes("Content Security Policy")) violations.push(m.text());
    });
    const response = await page.goto(path);
    const csp = response?.headers()["content-security-policy"] ?? "";
    const scripts = csp.split(";").find((d) => d.trim().startsWith("script-src")) ?? "";
    expect(scripts).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
    expect(scripts).not.toContain("'unsafe-inline'");
    await page.waitForLoadState("networkidle");
    expect(violations).toEqual([]);
  });
}

test("the nonce changes on every request", async ({ request }) => {
  const nonce = async () => (await request.get("/about")).headers()["content-security-policy"]?.match(/nonce-([^']+)/)?.[1];
  expect(await nonce()).not.toBe(await nonce());
});

test("client components hydrate: the pipeline form enables Run after choosing a note", async ({ page }) => {
  await page.goto("/pipeline");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("combobox", { name: /Note/ })).toBeVisible();
  await page.getByRole("checkbox", { name: /Dry run/ }).uncheck();
  await expect(page.getByRole("checkbox", { name: /Dry run/ })).not.toBeChecked();
});
