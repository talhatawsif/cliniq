"use server";
import { FhirError } from "@/lib/fhir";
import { guardText } from "@/lib/quota";
import type { Result } from "@/lib/hl7v2/process";
import { runHl7 } from "@/lib/hl7v2/server";
import { currentUser } from "@/lib/supabase";

export type State = { result?: Result; error?: string } | null;

export async function sendHl7(_prev: State, form: FormData): Promise<State> {
  const me = await currentUser();
  if (!me) return { error: "Sign in required" };
  if (me.readOnly) return { error: "This account is read-only" };
  const user = me.id;
  const text = String(form.get("message") ?? "");
  const refused = await guardText(text, "hl7");
  if (refused) return { error: ((await refused.json()) as { error: string }).error };
  try {
    return { result: await runHl7(text, { dryRun: form.get("dryRun") === "on", agent: user }) };
  } catch (e) {
    if (e instanceof FhirError) return { error: "FHIR server unavailable, retry later" };
    throw e;
  }
}
