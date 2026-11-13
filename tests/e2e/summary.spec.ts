import { loadEnvFile } from "node:process";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

loadEnvFile(".env.local");
const FHIR = process.env.FHIR_BASE_URL ?? "http://localhost:8080/fhir";
const patientId = async () =>
  (
    (await (await fetch(`${FHIR}/Patient?_count=1&_sort=family`)).json()) as {
      entry: { resource: { id: string } }[];
    }
  ).entry[0].resource.id;

test("export: a readable view, a JSON download, and an audit row", async ({ page }) => {
  const id = await patientId();
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  });
  const exports = async () =>
    (
      await db
        .from("audit_events")
        .select("id", { count: "exact", head: true })
        .eq("entity", `Patient/${id}`)
        .eq("action", "export")
    ).count ?? 0;
  const before = await exports();

  await page.goto(`/patient/${id}`);
  await page.getByRole("link", { name: "Export summary" }).click();
  await expect(page.getByRole("heading", { name: "Patient Summary" })).toBeVisible();
  for (const h of ["Problems", "Allergies and adverse reactions", "Medicines"]) {
    await expect(page.getByRole("heading", { name: h })).toBeVisible();
  }

  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download FHIR JSON" }).click();
  const file = await (await download).path();
  const bundle = JSON.parse(await (await import("node:fs/promises")).readFile(file, "utf8"));
  expect(bundle.resourceType).toBe("Bundle");
  expect(bundle.type).toBe("document");
  expect(bundle.entry[0].resource.resourceType).toBe("Composition");
  await expect.poll(exports).toBe(before + 1);
});
