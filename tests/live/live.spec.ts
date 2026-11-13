import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

test.setTimeout(240_000);
test("live: sign in, send the demo HL7 message, see creatinine 132 in the chart", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Sign in as demo clinician" }).click();
  await page.waitForURL("**/patients", { timeout: 180_000 });
  const msg = readFileSync("data/hl7v2/oru-demo-creatinine.hl7", "utf8").replace("DEMO00001", `LIVE${Date.now().toString(36)}`);
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
