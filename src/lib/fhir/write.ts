import "server-only";
import type { Bundle, OperationOutcome } from "fhir/r4";
import { fhirPost } from "./client";

const errorsOf = (json: unknown) =>
  ((json as OperationOutcome | null)?.issue ?? [])
    .filter((i) => i.severity === "error" || i.severity === "fatal")
    .map((i) => `${i.expression?.[0] ?? ""} ${i.diagnostics ?? i.details?.text ?? i.code}`.trim());

/** Error messages from `Bundle/$validate`; empty when valid. */
export async function validateBundle(bundle: Bundle): Promise<string[]> {
  const { status, json } = await fhirPost("Bundle/$validate", bundle);
  const errors = errorsOf(json);
  return errors.length || status < 400 ? errors : [`validation request failed with status ${status}`];
}

/** Posts a transaction Bundle. Returns the response Bundle; throws with the server's message on failure. */
export async function writeBundle(bundle: Bundle): Promise<Bundle> {
  const { status, json } = await fhirPost("", bundle);
  if (status === 412) throw new Error("The record changed since it was read. Reload and try again.");
  if (status >= 400) throw new Error(`FHIR write failed: ${status} ${errorsOf(json)[0] ?? ""}`.trim());
  return json as Bundle;
}

/** "Condition/123/_history/1" -> "123" for the entry at `index` of a transaction response. */
export const createdId = (response: Bundle, index: number) =>
  /^[A-Za-z]+\/([^/]+)/.exec(response.entry?.[index]?.response?.location ?? "")?.[1];
