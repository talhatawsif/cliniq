import { loadEnvFile } from "node:process";
import { createClient } from "@supabase/supabase-js";
import { test as setup } from "@playwright/test";

loadEnvFile(".env.local");

// Repeated local runs would otherwise use up the daily HL7 quota (50), which the tests share with the live app.
setup("reset the daily HL7 quota", async () => {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  });
  await db.from("quotas").delete().eq("name", "hl7");
});

setup("sign in as the demo clinician", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Sign in as demo clinician" }).click();
  await page.waitForURL("**/patients");
  await page.context().storageState({ path: "tests/e2e/.auth.json" });
});
