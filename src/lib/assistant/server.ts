import "server-only";
import type { DocumentReference, Resource } from "fhir/r4";
import { env } from "@/lib/env";
import { fhirSearch } from "@/lib/fhir/client";
import { getAllergies, getChartData, getConditions, getObservations, getPatient } from "@/lib/fhir";
import { consumeQuota, LIMITS, quotaRemaining } from "@/lib/quota";
import { admin } from "@/lib/supabase";
import { type Answer, type Deps, answer } from "./answer";
import { buildFacts } from "./facts";
import { callChain } from "./llm";
import { parseModels } from "./models";

// shortcut: the cache and the cost breaker live in this server instance's memory. A new serverless instance starts
// with both empty. Move them to a table if the free-tier cost guard ever needs to be global.
const cache: Deps["cache"] = new Map();
let breaker = false;

const NOTE_QUESTION = /\b(note|letter|referral|discharge|summary|clinic|consult)/i;

async function patientData(id: string, withNotes: boolean) {
  const [conditions, allergies, chart, labs, vitals, notes] = await Promise.all([
    getConditions(id),
    getAllergies(id),
    getChartData(id),
    getObservations(id, "laboratory"),
    getObservations(id, "vital-signs"),
    withNotes
      ? fhirSearch<DocumentReference>(`DocumentReference?patient=${id}&_sort=-date&_count=2`, { maxPages: 1 })
      : Promise.resolve([]),
  ]);
  return { conditions, allergies, ...chart, observations: [...labs, ...vitals], notes };
}

const log: Deps["log"] = async (r) => {
  const outcome = r.outcome === "error" && r.cost > 0 ? "error" : r.outcome;
  await admin().from("llm_calls").insert({
    model: r.model,
    latency_ms: r.latencyMs,
    prompt_tokens: r.promptTokens,
    completion_tokens: r.completionTokens,
    cost: r.cost,
    outcome,
  });
};

export type Citation = { id: string; label: string; resource: Resource | null };
export type AssistantResponse = Answer & { citations: Citation[]; remaining: number };

/** The fact list for one patient, and the newest meta.lastUpdated of their data (the cache version). Null if no such patient. */
export async function loadFacts(patientId: string, question: string, extraNotes: DocumentReference[] = []) {
  const patient = await getPatient(patientId);
  if (!patient) return null;
  const data = await patientData(patientId, NOTE_QUESTION.test(question));
  data.notes = [...extraNotes, ...data.notes]; // extraNotes: evaluation only
  const facts = buildFacts(patientId, data);
  const version =
    [
      patient,
      ...data.conditions,
      ...data.allergies,
      ...data.medications,
      ...data.observations,
      ...data.encounters,
      ...data.immunizations,
    ]
      .map((r) => r.meta?.lastUpdated ?? "")
      .sort()
      .at(-1) ?? "";
  return { facts, version };
}

/** Answers one question about one patient. Facts come only from the patient id the route was called with. */
export async function runAssistant(patientId: string, question: string): Promise<AssistantResponse | null> {
  const loaded = await loadFacts(patientId, question);
  if (!loaded) return null;
  const { facts, version } = loaded;

  const key = env.OPENROUTER_API_KEY;
  const models = env.OPENROUTER_MODELS ? parseModels(env.OPENROUTER_MODELS) : [];
  const result = await answer(question, patientId, version, facts, {
    llm: key && models.length ? (messages) => callChain({ key, models, messages }) : null,
    takeQuota: () => consumeQuota("assistant", LIMITS.assistant),
    breakerOpen: () => breaker,
    openBreaker: () => void (breaker = true),
    cache,
    log,
  });
  const byId = new Map(facts.map((f) => [f.id, f]));
  const ids = [...new Set(result.sentences.flatMap((s) => s.ids))];
  return {
    ...result,
    citations: ids.map((id) => ({
      id,
      label: byId.get(id)?.text.split(" — ")[0].slice(0, 80) ?? id,
      resource: byId.get(id)?.resource ?? null,
    })),
    remaining: await quotaRemaining("assistant"),
  };
}
