import { copyFileSync, mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { card, caption, glide, pause, setup } from "./helpers";

test("record the demo video", async ({ page }) => {
  test.setTimeout(900_000);
  await setup(page);
  const say = async (text: string, ms: number) => {
    await caption(page, text);
    await pause(page, ms);
  };

  await card(
    page,
    "ClinIQ",
    [
      "Clinical notes and HL7 pathology to coded, validated FHIR",
      "with a clinician in the loop",
      "Synthetic data only. A portfolio prototype, not a medical device.",
    ],
    5000,
  );

  // 1. Sign in
  await page.goto("/sign-in");
  await say("One click sign-in as the shared demo clinician. Every view is audited.", 3500);
  await glide(page, page.getByRole("button", { name: "Sign in as demo clinician" }));
  await page.waitForURL("**/patients", { timeout: 120_000 });

  // 2. Worklist and chart
  await say("The worklist: 20 Australian synthetic patients on a private FHIR R4 server in Sydney.", 4500);
  await page.mouse.wheel(0, 300);
  await pause(page, 1200);
  await page.mouse.wheel(0, -300);
  await glide(page, page.locator("#q"));
  await page.keyboard.type("Beier", { delay: 120 });
  await page.keyboard.press("Enter");
  await page.waitForURL(/q=Beier/);
  await say("Search by name or by IHI.", 2500);
  await glide(page, page.getByRole("link", { name: /BEIER/ }).first());
  await page.waitForURL(/\/patient\//, { timeout: 120_000 });
  await say(
    "The chart. The banner repeats name, date of birth, sex and IHI, and allergies are always visible.",
    5000,
  );
  await say("Decision support from a CDS Hooks service: eGFR (CKD-EPI 2021), BMI and care gaps.", 5000);
  await page.getByRole("heading", { name: "Decision support" }).scrollIntoViewIfNeeded();
  await pause(page, 1500);

  // 3. Assistant
  const panel = page.getByTestId("assistant");
  await panel.scrollIntoViewIfNeeded();
  await say(
    "Ask about this record. Common questions are answered from the record with no model, every sentence cited.",
    4500,
  );
  await glide(page, panel.getByRole("button", { name: "Current medicines" }));
  await expect(page.getByTestId("assistant-answer")).toHaveAttribute("data-kind", "scripted", {
    timeout: 60_000,
  });
  await say("The citation chip opens the exact FHIR resource.", 3000);
  await glide(
    page,
    page
      .getByTestId("assistant-answer")
      .getByRole("button", { name: /Open the record for/ })
      .first(),
  );
  await say(
    "The FHIR JSON drawer repeats the patient banner so nothing is read against the wrong patient.",
    5000,
  );
  await page.keyboard.press("Escape");
  await glide(page, panel.getByLabel("Ask a question about this record"));
  await page.keyboard.type("Should I stop the simvastatin?", { delay: 70 });
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("assistant-answer")).toHaveAttribute("data-kind", "refused", {
    timeout: 30_000,
  });
  await say("Advice requests are refused by a deterministic filter, with no model call.", 4500);

  // 4. Pathology, vitals
  await glide(page, page.getByRole("link", { name: "Pathology" }));
  await page.waitForURL(/pathology/);
  await say(
    "Pathology trends by analyte. Out-of-range results are flagged, and units are converted, never merged by text.",
    5500,
  );
  await page.mouse.wheel(0, 500);
  await pause(page, 2500);
  await glide(page, page.getByRole("link", { name: "Vitals" }));
  await page.waitForURL(/vitals/);
  await say("Vitals, with blood pressure as one chart. Every chart has a table view.", 4500);
  await glide(page, page.getByRole("button", { name: "Show table" }).first());
  await pause(page, 2500);

  // 5. Summary export
  await glide(page, page.getByRole("link", { name: "Export summary" }));
  await page.waitForURL(/summary/);
  await say(
    "AU Patient Summary export: a FHIR document Bundle, validated against AU PS 1.0.0. Only confirmed data goes in.",
    6000,
  );

  // 6. Pipeline: note to coded FHIR
  await page.goto("/pipeline");
  await say("Notes to coded FHIR. Pick a note, extract, code, validate, write.", 4000);
  await page
    .getByRole("combobox", { name: /Note/ })
    .selectOption({ label: "GP consultation: diabetes cycle of care" });
  await pause(page, 1500);
  await glide(page, page.getByRole("button", { name: "Run" }));
  const result = page.getByTestId("pipeline-result");
  await expect(result).toBeVisible({ timeout: 180_000 });
  await say(
    "A dry run. Negated, family and hypothetical mentions are never written; each shows its reason.",
    6000,
  );
  await result.scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 400);
  await pause(page, 3500);
  await page.mouse.wheel(0, -400);
  await say(
    "Now for real: untick dry run, and the findings are written as unconfirmed Conditions with Provenance.",
    5000,
  );
  await glide(page, page.getByRole("checkbox", { name: /Dry run/ }));
  await glide(page, page.getByRole("button", { name: "Run" }));
  await expect(page.getByTestId("pipeline-result")).toContainText(/unconfirmed Condition\(s\) written/, {
    timeout: 180_000,
  });
  await pause(page, 3000);

  // 7. Review queue
  await glide(page, page.getByRole("link", { name: "Review", exact: true }).first());
  await page.waitForURL(/review/);
  await say(
    "The review queue. The excerpt is highlighted, the patient banner repeated, and the code has a confidence and a rationale.",
    6500,
  );
  const item = page
    .getByTestId("review-item")
    .filter({ hasText: /HACKETT/ })
    .first();
  await item.scrollIntoViewIfNeeded();
  await pause(page, 2500);
  await say("Confirm, change the code, or reject. Confirming records who verified it.", 4000);
  await glide(page, item.getByRole("button", { name: "Confirm" }));
  await pause(page, 3500);
  await page.goto("/patients?q=Hackett");
  await glide(page, page.getByRole("link", { name: /HACKETT/ }).first());
  await page.waitForURL(/\/patient\//);
  await say(
    "Back on the chart, the finding is now confirmed. Unconfirmed ones show a badge and are kept out of decision support.",
    6000,
  );
  await page.getByRole("heading", { name: "Problems" }).scrollIntoViewIfNeeded();
  await pause(page, 2500);

  // 8. HL7
  await page.goto("/hl7");
  await say(
    "HL7 v2 pathology in: paste or pick an ORU message, map to FHIR, validate, and reply with an ACK.",
    5500,
  );
  await page.getByRole("combobox", { name: /Sample/ }).selectOption("oru-demo-creatinine.hl7");
  await glide(page, page.getByRole("button", { name: "Send" }));
  await expect(page.getByTestId("ack")).toContainText("MSA|AA|", { timeout: 120_000 });
  await say(
    "Dry run: the ACK says AA and nothing is written. An unknown patient gets AE and is never created.",
    5500,
  );
  await page.mouse.wheel(0, 500);
  await pause(page, 3000);

  // 9. About
  await page.goto("/about");
  await say(
    "Limits are stated plainly: synthetic data, AI-labelled evaluation, free-model assistant, and the path to production.",
    6000,
  );
  await page.mouse.wheel(0, 600);
  await pause(page, 3500);

  await card(
    page,
    "ClinIQ",
    [
      "FHIR R4 · AU Core · AU Patient Summary · HL7 v2 · CDS Hooks · SMART on FHIR · SNOMED CT-AU",
      "Live: cliniq-inky-ten.vercel.app",
      "Built with Claude Code",
    ],
    6000,
  );

  const path = await page.video()!.path();
  await page.context().close();
  mkdirSync("docs/video", { recursive: true });
  copyFileSync(path, "docs/video/cliniq-demo.webm");
});
