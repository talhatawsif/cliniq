import "server-only";
import { z } from "zod";
import { env } from "@/lib/env";
import { fhirAuthHeader } from "@/lib/fhir/auth";
import precomputed from "../../../data/nlp/precomputed.json";

const entity = z.object({
  text: z.string(),
  start: z.number().int(),
  end: z.number().int(),
  term: z.string(),
  section: z.string(),
  negated: z.boolean(),
  family: z.boolean(),
  historical: z.boolean(),
  hypothetical: z.boolean(),
  uncertain: z.boolean(),
});
const response = z.object({ entities: z.array(entity) });

export type Entity = z.infer<typeof entity>;
/** `precomputed` means the saved output for a sample note, not a live run. `reason` says why it was used. */
export type Extraction = { engine: "medspacy" | "precomputed"; entities: Entity[]; reason?: string };

const saved = precomputed.notes as Record<string, { entities: Entity[] }>;

/** "Affirmed" means no context flag is set; only affirmed entities go forward to coding. */
export const isAffirmed = (e: Entity) =>
  !(e.negated || e.family || e.historical || e.hypothetical || e.uncertain);

const fromSaved = (noteFile: string | undefined, reason: string): Extraction => {
  const hit = noteFile ? saved[noteFile] : undefined;
  if (!hit) throw new Error(`NLP unavailable (${reason}) and there is no precomputed output for this text`);
  return { engine: "precomputed", entities: hit.entities, reason };
};

/**
 * Entities from the medspaCy service, or the saved output for a sample note when the service is not
 * configured or does not answer. The result always says which engine produced it.
 */
export async function extractEntities(text: string, noteFile?: string): Promise<Extraction> {
  const base = env.NLP_SERVICE_URL;
  if (!base) return fromSaved(noteFile, "NLP_SERVICE_URL is not set");
  try {
    const url = `${base.replace(/\/$/, "")}/extract`;
    const res = await fetch(url, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json", ...(await fhirAuthHeader(new URL(url).origin)) },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(45_000), // a cold start loads the models first
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    return { engine: "medspacy", entities: response.parse(await res.json()).entities };
  } catch {
    return fromSaved(noteFile, "the NLP service did not answer");
  }
}
