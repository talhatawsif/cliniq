import { loadEnvFile } from "node:process";
import { expect, test, type Page } from "@playwright/test";
import type { Bundle, Condition, Provenance } from "fhir/r4";
import { createClient } from "@supabase/supabase-js";

loadEnvFile(".env.local");
test.describe.configure({ mode: "serial" });

const FHIR = process.env.FHIR_BASE_URL ?? "http://localhost:8080/fhir";
const TAG = "https://github.com/talhatawsif/cliniq/fhir/CodeSystem/tags|auto-extracted";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});
// no-cache: HAPI reuses search results for 60 s otherwise
const get = async <T>(path: string) =>
  (await (await fetch(`${FHIR}/${path}`, { headers: { "Cache-Control": "no-cache" } })).json()) as T;
const conditions = async () =>
  ((await get<Bundle>(`Condition?_tag=${encodeURIComponent(TAG)}&_count=100`)).entry ?? []).map(
    (e) => e.resource as Condition,
  );
  "01-referral-nephrology",
  "02-discharge-pneumonia",
  "03-consult-diabetes-review",
  "05-consult-cardiology",
  "10-discharge-heart-failure",
];

test.beforeAll(async () => {
  // A clean slate on the local server: earlier auto-extracted findings, their Provenance and queue rows.
  // Provenance first: HAPI refuses to delete a Condition that is still referenced.
  for (const q of ["Provenance?recorded=ge2000-01-01", `Condition?_tag=${encodeURIComponent(TAG)}`]) {
    const res = await fetch(`${FHIR}/${q}`, { method: "DELETE" });
    if (!res.ok) throw new Error(`cleanup failed: ${q} ${res.status}`);
  }
  await db.from("review_items").delete().neq("status", "none");
  await db.from("quotas").delete().eq("name", "pipeline");
});

async function run(page: Page, title: RegExp, dryRun = false) {
  await page.goto("/pipeline");
  await page
    .getByRole("combobox", { name: /Note/ })
    .selectOption({ label: (await page.getByRole("option", { name: title }).first().textContent())! });
  if (!dryRun) await page.getByRole("checkbox", { name: /Dry run/ }).uncheck();
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByTestId("pipeline-result")).toBeVisible({ timeout: 60_000 });
}

const code = (c: Condition) => c.code?.coding?.[0]?.code;
const history = async (id: string) => (await get<Bundle>(`Condition/${id}/_history`)).total ?? 0;
const provenance = async (id: string) =>
  ((await get<Bundle>(`Provenance?target=Condition/${id}`)).entry ?? []).map((e) => e.resource as Provenance);
const findingsFor = async (c: string) => (await conditions()).filter((x) => code(x) === c);

test("dry run validates and writes nothing; negated, family and repeated mentions are shown with the reason", async ({
  page,
}) => {
  const before = (await conditions()).length;
  await run(page, /nephrology/, true);
  const result = page.getByTestId("pipeline-result");
  await expect(result).toContainText("Dry run: nothing was written");
  await expect(result).toContainText("Would be written");
  await expect(result).toContainText("Not written: negated");
  await expect(result).toContainText("Not written: family history");
  expect((await conditions()).length).toBe(before);
  await expect(result.getByText(/^Validate and write · \d+ ms$/)).toBeVisible(); // timings per step
});

test("sample note 1: unconfirmed Condition and Provenance, badge on the chart, confirm in /review", async ({
  page,
}) => {
  await run(page, /nephrology/);
  const result = page.getByTestId("pipeline-result");
  await expect(result).toContainText("Written, pending review");
  const made = await conditions();
  expect(made.length).toBeGreaterThan(0);
  const c = made[0];
  expect(c.verificationStatus?.coding?.[0].code).toBe("unconfirmed");
  expect(c.meta?.tag?.some((t) => t.code === "auto-extracted")).toBe(true);
  const prov = await provenance(c.id!);
  expect(prov).toHaveLength(1);
  expect(prov[0].activity?.coding?.[0].code).toBe("CREATE");

  // W10: the chart shows the badge
  const patientId = c.subject.reference!.split("/")[1];
  await page.goto(`/patient/${patientId}`);
  await expect(page.getByText("Auto-extracted — pending review").first()).toBeVisible();

  // Confirm in /review
  await page.goto("/review");
  const card = page
    .getByTestId("review-item")
    .filter({ hasText: code(c)! })
    .first();
  await expect(card.locator("mark")).toBeVisible();
  await expect(card).toContainText("IHI"); // the patient banner is repeated on every card
  const itemId = await card.getAttribute("data-item-id");
  await card.getByRole("button", { name: "Confirm" }).click();
  await expect(page.locator(`[data-item-id="${itemId}"]`)).toHaveCount(0); // decided items leave the queue

  const after = await get<Condition>(`Condition/${c.id}`);
  expect(after.verificationStatus?.coding?.[0].code).toBe("confirmed");
  expect(await history(c.id!)).toBe(2);
  const decision = (await provenance(c.id!)).find((p) => p.activity?.coding?.[0].code === "UPDATE")!;
  expect(decision.agent[0].type?.coding?.[0].code).toBe("verifier");
  const who = await get<{ resourceType: string; name: { family: string }[] }>(
    decision.agent[0].who.reference!,
  );
  expect(who.resourceType).toBe("Practitioner");

  await page.goto(`/patient/${patientId}`);
  const row = page.getByRole("row", { name: new RegExp(c.code!.text!, "i") }).first();
  await expect(row).toContainText("confirmed");
});

test("W5: running the same note again creates nothing new", async ({ page }) => {
  const before = (await conditions()).length;
  await run(page, /nephrology/);
  await expect(page.getByTestId("pipeline-result")).toContainText("0 unconfirmed Condition(s) written");
  await expect(page.getByTestId("pipeline-result")).toContainText(
    /already extracted from this note|already on the problem list/,
  );
  expect((await conditions()).length).toBe(before);
});

test("change code and reject, each recorded in Provenance and history", async ({ page }) => {
  for (const t of [/pneumonia/i, /diabetes/i, /cardiology/i, /heart failure/i]) await run(page, t);
  await page.goto("/review");

  // Change: a card with alternatives
  const withAlt = page
    .getByTestId("review-item")
    .filter({ has: page.getByRole("radio") })
    .first();
  await expect(withAlt).toBeVisible();
  const changeId = await withAlt.getAttribute("data-item-id");
  const oldCode = (await withAlt.locator(".font-mono").first().textContent())!.trim();
  const alt = withAlt.getByRole("radio").first();
  const newCode = await alt.getAttribute("value");
  await alt.check();
  await withAlt.getByRole("button", { name: "Change to selected" }).click();
  await expect(page.locator(`[data-item-id="${changeId}"]`)).toHaveCount(0);
  const changed = (await conditions()).find(
    (c) => code(c) === newCode && c.verificationStatus?.coding?.[0].code === "confirmed",
  )!;
  expect(changed).toBeTruthy();
  expect(await history(changed.id!)).toBe(2);
  const reason = (await provenance(changed.id!)).find((p) => p.activity?.coding?.[0].code === "UPDATE")!
    .reason?.[0].text;
  expect(reason).toContain(oldCode);
  expect(reason).toContain(newCode!);
  const original = await get<Bundle>(`Condition/${changed.id}/_history/1`);
  expect((original as unknown as Condition).code?.coding?.[0].code).toBe(oldCode); // the original stays in history

  // Reject: another pending card
  const next = page.getByTestId("review-item").first();
  const rejectId = await next.getAttribute("data-item-id");
  const rejectedCode = (await next.locator(".font-mono").first().textContent())!.trim();
  await next.getByRole("button", { name: "Reject" }).click();
  await expect(page.locator(`[data-item-id="${rejectId}"]`)).toHaveCount(0);
  const rejected = (await findingsFor(rejectedCode)).find(
    (c) => c.verificationStatus?.coding?.[0].code === "refuted",
  )!;
  expect(rejected.clinicalStatus?.coding?.[0].code).toBe("inactive");
  const patientId = rejected.subject.reference!.split("/")[1];
  await page.goto(`/patient/${patientId}`);
  await expect(page.getByRole("row", { name: new RegExp(rejected.code!.text!, "i") })).toHaveCount(0);
});

test("W12: writes and each review decision are audited", async () => {
  const { data } = await db.from("audit_events").select("action,entity").like("entity", "Condition/%");
  const actions = new Set((data ?? []).map((r) => r.action));
  expect(actions.has("write")).toBe(true);
  expect(actions.has("review")).toBe(true);
  expect((data ?? []).filter((r) => r.action === "review").length).toBeGreaterThanOrEqual(3);
});
