"use server";
import { FhirError } from "@/lib/fhir";
import { type RunResult, runPipeline } from "@/lib/pipeline/run";
import { guardText } from "@/lib/quota";
import { currentUserId } from "@/lib/supabase";

export type State = { result?: RunResult; error?: string } | null;

export async function runNote(_prev: State, form: FormData): Promise<State> {
  const user = await currentUserId();
  if (!user) return { error: "Sign in required" };
  const text = String(form.get("text") ?? "");
  const refused = await guardText(text, "pipeline");
  if (refused) return { error: ((await refused.json()) as { error: string }).error };
  const docId = String(form.get("docId") ?? "") || undefined;
  try {
    return {
      result: await runPipeline({
        docId,
        patientId: String(form.get("patientId") ?? "") || undefined,
        text,
        dryRun: form.get("dryRun") === "on",
        userId: user,
      }),
    };
  } catch (e) {
    if (e instanceof FhirError) return { error: "FHIR server unavailable, retry later" };
    return { error: e instanceof Error ? e.message : "The pipeline failed" };
  }
}
