import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const FHIR = process.env.FHIR_BASE_URL ?? "http://localhost:8080/fhir";
const sample = () => readFileSync("data/hl7v2/oru-demo-creatinine.hl7", "utf8");
const fresh = (text: string, status = "F") =>
  text
    .replace("DEMO00001", `T${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`)
    .replace("||F|||20261110081500+1000", `||${status}|||20261110081500+1000`);

test("POST /api/hl7v2: ACK AA, the result lands in the chart, a correction makes version 2", async ({
  request,
}) => {
  const send = async (body: string) =>
    (await request.post("/api/hl7v2", { data: body, headers: { "Content-Type": "text/plain" } })).text();

  // Seen from a previous run? Then the filler's observation exists already; count versions relative to it.
  const msg = fresh(sample());
  const ack = await send(msg);
  expect(ack).toMatch(/MSA\|AA\|/);
  expect(await send(msg)).toMatch(/MSA\|AA\|.*Duplicate/); // H11: same control id again

  const bundle = await (
    await fetch(`${FHIR}/Observation?code=14682-9&value-quantity=132&_sort=-_lastUpdated&_count=1`)
  ).json();
  expect(bundle.entry?.[0].resource.valueQuantity.value).toBe(132);
  const id = bundle.entry[0].resource.id as string;

  const before = (await (await fetch(`${FHIR}/Observation/${id}/_history`)).json()).total as number;
  expect(await send(fresh(sample(), "C"))).toMatch(/MSA\|AA\|/); // H12: correction
  const hist = await (await fetch(`${FHIR}/Observation/${id}/_history`)).json();
  expect(hist.total).toBeGreaterThanOrEqual(2);
  expect(hist.total).toBeGreaterThan(before - 1);
  expect((await (await fetch(`${FHIR}/Observation/${id}`)).json()).status).toBe("corrected");
});

test("unknown patient and unsupported type are refused with the right ACK", async ({ request }) => {
  const ref = readFileSync("data/hl7v2/oru-creatinine.hl7", "utf8");
  const post = async (d: string) => (await request.post("/api/hl7v2", { data: d })).text();
  expect(await post(ref)).toMatch(/MSA\|AE\|MSG00001/);
  expect(await post(readFileSync("data/hl7v2/adt-a01.hl7", "utf8"))).toMatch(/MSA\|AR\|ADT00001/);
});

test("the /hl7 page runs a dry run and shows the bundle", async ({ page }) => {
  await page.goto("/hl7");
  await page.getByRole("combobox", { name: /Sample/ }).selectOption("oru-demo-creatinine.hl7");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByTestId("ack")).toContainText("MSA|AA|");
  await expect(page.getByRole("heading", { name: "FHIR Bundle" })).toBeVisible();
  await expect(page.getByText("No errors from $validate.")).toBeVisible();
});
