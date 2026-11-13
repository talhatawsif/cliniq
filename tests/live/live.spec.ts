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

test("live: the assistant answers a suggested question from the record and refuses advice", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Sign in as demo clinician" }).click();
  await page.waitForURL("**/patients", { timeout: 180_000 });
  await page.getByRole("link", { name: /BEIER/ }).first().click();
  const panel = page.getByTestId("assistant");
  await panel.getByRole("button", { name: "Current medicines" }).click();
  await expect(page.getByTestId("assistant-answer")).toHaveAttribute("data-kind", "scripted", {
    timeout: 60_000,
  });
  await panel.getByLabel("Ask a question about this record").fill("Should I stop the simvastatin?");
  await panel.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page.getByTestId("assistant-answer")).toHaveAttribute("data-kind", "refused");
  await page.screenshot({ path: "docs/ui/screens/m13/live-assistant.png", fullPage: true });
});

test("live: a pasted one-line note keeps its cues apart, and the form keeps the user's choices", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Sign in as demo clinician" }).click();
  await page.waitForURL("**/patients", { timeout: 180_000 });
  await page.goto("/pipeline");
  await page.getByRole("combobox", { name: /Note/ }).selectOption({ label: "Paste a note…" });
  await page.getByLabel("Note text").fill("PMHx: HTN. Denies chest pain. FHx: Father had IHD.");
  await page.getByRole("button", { name: "Run" }).click();
  const result = page.getByTestId("pipeline-result");
  await expect(result).toBeVisible({ timeout: 120_000 });
  await expect(result).toContainText("Engine: medspaCy");
  await expect(result.getByRole("row", { name: /IHD/ })).toContainText("family history");
  await expect(result.getByRole("row", { name: /chest pain/ })).toContainText("negated");
  await expect(page.getByRole("combobox", { name: /Note/ })).toHaveValue("");
});
