import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

test.setTimeout(240_000);
test("live: sign in, send the demo HL7 message, see creatinine 132 in the chart", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Sign in as demo clinician" }).click();
  await page.waitForURL("**/patients", { timeout: 180_000 });
  const msg = readFileSync("data/hl7v2/oru-demo-creatinine.hl7", "utf8").replace(
    "DEMO00001",
    `LIVE${Date.now().toString(36)}`,
  );
  const res = await page.request.post("/api/hl7v2", { data: msg, timeout: 180_000 });
  const ack = await res.text();
  console.log(ack.replace(/\r/g, "\n"));
  expect(ack).toMatch(/MSA\|AA\|/);
  await page.goto("/patients?q=Beier");
  await page.getByRole("link", { name: /BEIER/ }).first().click();
  await page.getByRole("link", { name: "Pathology" }).click();
  await expect(page.getByText(/132/).first()).toBeVisible();
  await page.screenshot({ path: "docs/ui/screens/m7/live-pathology.png", fullPage: true });
});

test("live: the patient summary export works", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Sign in as demo clinician" }).click();
  await page.waitForURL("**/patients", { timeout: 180_000 });
  await page.getByRole("link", { name: /BEIER/ }).first().click();
  await page.getByRole("link", { name: "Export summary" }).click();
  await expect(page.getByRole("heading", { name: "Patient Summary" })).toBeVisible({ timeout: 60_000 });
  await page.screenshot({ path: "docs/ui/screens/m8/live-summary.png", fullPage: true });
});

test("live: run a sample note, confirm a finding in /review", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Sign in as demo clinician" }).click();
  await page.waitForURL("**/patients", { timeout: 180_000 });
  await page.goto("/pipeline");
  const label = (await page
    .getByRole("option", { name: /cardiology/i })
    .first()
    .textContent())!;
  await page.getByRole("combobox", { name: /Note/ }).selectOption({ label });
  await page.getByRole("checkbox", { name: /Dry run/ }).uncheck();
  await page.getByRole("button", { name: "Run" }).click();
  const result = page.getByTestId("pipeline-result");
  await expect(result).toBeVisible({ timeout: 180_000 });
  console.log((await result.innerText()).slice(0, 1500));
  await expect(result).toContainText("Engine: medspaCy"); // the live NLP service answered, not the saved output
  await expect(result).toContainText("Written, pending review");
  await page.screenshot({ path: "docs/ui/screens/m11/live-pipeline.png", fullPage: true });
  await page.goto("/review");
  const card = page.getByTestId("review-item").first();
  const text = (await card.innerText()).slice(0, 400);
  console.log(text);
  await page.screenshot({ path: "docs/ui/screens/m11/live-review.png", fullPage: true });
  await card.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByTestId("review-item").first()).not.toHaveAttribute(
    "data-item-id",
    (await card.getAttribute("data-item-id")) ?? "",
  );
});
