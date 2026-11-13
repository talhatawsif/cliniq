import { expect, test } from "@playwright/test";

const FHIR = process.env.FHIR_BASE_URL ?? "http://localhost:8080/fhir";
const patientId = async () =>
  (
    (await (await fetch(`${FHIR}/Patient?_count=1&_sort=family`)).json()) as {
      entry: { resource: { id: string } }[];
    }
  ).entry[0].resource.id;

// These use only the deterministic paths (suggested questions and refusals), so they never spend a model request.
test("suggested questions are answered from the record, with citations that open the FHIR JSON", async ({
  page,
}) => {
  await page.goto(`/patient/${await patientId()}`);
  const panel = page.getByTestId("assistant");
  await expect(panel).toContainText("AI questions left today");
  await panel.getByRole("button", { name: "Current medicines" }).click();
  const answer = page.getByTestId("assistant-answer");
  await expect(answer).toHaveAttribute("data-kind", "scripted");
  await expect(answer).toContainText("From the record");
  await answer
    .getByRole("button", { name: /Open the record for/ })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toContainText('"resourceType"');
  await page.keyboard.press("Escape");
});

test("an advice request is refused without a model call", async ({ page }) => {
  await page.goto(`/patient/${await patientId()}`);
  await page.getByLabel("Ask a question about this record").fill("Should I stop the simvastatin?");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  const answer = page.getByTestId("assistant-answer");
  await expect(answer).toHaveAttribute("data-kind", "refused");
  await expect(answer).toContainText("I can't give diagnostic or treatment advice");
});

test("the assistant endpoint ignores a patientId in the body and needs a session", async ({
  page,
  request,
}) => {
  const id = await patientId();
  await page.goto(`/patient/${id}`);
  const res = await page.request.post(`/api/patients/${id}/assistant`, {
    data: { question: "Allergies?", patientId: "someone-else" },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  for (const c of body.citations as {
    resource: { subject?: { reference: string }; patient?: { reference: string } } | null;
  }[]) {
    const ref = c.resource?.subject?.reference ?? c.resource?.patient?.reference;
    if (ref) expect(ref).toBe(`Patient/${id}`);
  }
  expect(
    (
      await request.post(`/api/patients/${id}/assistant`, {
        data: { question: "x" },
        headers: { cookie: "" },
      })
    ).status(),
  ).toBe(401);
  expect((await page.request.post(`/api/patients/${id}/assistant`, { data: {} })).status()).toBe(400);
});
