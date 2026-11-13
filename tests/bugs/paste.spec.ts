// Needs a local NLP service: docker build -t cliniq-nlp:local services/nlp && docker run -d --rm --name nlp-local -p 8090:8080 cliniq-nlp:local
import { expect, test } from "@playwright/test";

test("pasting a note: choose a patient, dry run, then write", async ({ browser }) => {
  const ctx = await browser.newContext({
    storageState: "tests/e2e/.auth.json",
    baseURL: "http://localhost:3100",
  });
  const page = await ctx.newPage();
  await page.goto("/pipeline");
  await page.getByRole("combobox", { name: /Note/ }).selectOption({ label: "Paste a note…" });
  await page
    .getByLabel("Note text")
    .fill("PMHx: HTN, T2DM. Denies chest pain. FHx: Father had IHD. If she develops a fever, return.");
  await page.getByRole("combobox", { name: /Patient/ }).selectOption({ index: 3 });
  await page.getByRole("button", { name: "Run" }).click();
  const result = page.getByTestId("pipeline-result");
  await expect(result).toBeVisible({ timeout: 60_000 });
  const text = await result.innerText();
  expect(text).toContain("Dry run");
  await expect(result).toContainText("Not written: negated");
  await expect(result).toContainText("Not written: family history");
  await expect(result).not.toContainText("fever Would be written");
  // After a run the picker still says "paste" and the dry-run box keeps the user's choice (React 19 used to reset both).
  await expect(page.getByRole("combobox", { name: /Note/ })).toHaveValue("");
  await page.getByRole("checkbox", { name: /Dry run/ }).uncheck();
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByTestId("pipeline-result")).toContainText(/unconfirmed Condition\(s\) written/, {
    timeout: 60_000,
  });
  await expect(page.getByRole("checkbox", { name: /Dry run/ })).not.toBeChecked();
});
