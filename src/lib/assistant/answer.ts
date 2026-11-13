// The assistant pipeline (docs/AI.md §3). Deterministic steps first; the model is one call, then filtered.
import { type Fact } from "./facts";
import { type Filtered, type Sentence, filterReply } from "./filter";
import type { CallRecord, ChainResult, Message } from "./llm";
import { PROMPT_VERSION, SYSTEM, userMessage } from "./prompt";
import { REFUSAL, prefilter } from "./prefilter";
import { SUGGESTIONS, scripted } from "./scripted";

export type Kind = "refused" | "scripted" | "ai" | "no_answer" | "limit" | "unavailable" | "not_configured";
export type Answer = {
  kind: Kind;
  sentences: Sentence[];
  /** Sentences the filter dropped. */
  removed: number;
  message?: string;
  model?: string;
  ms?: number;
  cached?: boolean;
  suggestions?: string[];
};

export type Deps = {
  /** Null when no key or no models are configured. */
  llm: ((messages: Message[]) => Promise<ChainResult>) | null;
  /** Takes one of the daily model calls; false when the limit is reached. */
  takeQuota: () => Promise<boolean>;
  /** The LLM was disabled by the cost breaker. */
  breakerOpen: () => boolean;
  openBreaker: () => void;
  cache: Map<string, { at: number; answer: Answer }>;
  log: (r: CallRecord, outcome?: string) => Promise<void> | void;
  now?: () => number;
};

export const DAY_MS = 24 * 60 * 60 * 1000;
const normalise = (q: string) =>
  q
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const help = (): Pick<Answer, "suggestions"> => ({ suggestions: SUGGESTIONS });
const none = (kind: Kind, message: string, extra: Partial<Answer> = {}): Answer => ({
  kind,
  sentences: [],
  removed: 0,
  message,
  ...help(),
  ...extra,
});

/** `version` is the newest meta.lastUpdated across the patient's data, so a changed record misses the cache. */
export async function answer(
  question: string,
  patientId: string,
  version: string,
  facts: Fact[],
  deps: Deps,
): Promise<Answer> {
  const now = deps.now ?? Date.now;

  // 1. Pre-filter: no model call.
  if (prefilter(question)) return none("refused", REFUSAL);

  // 2. Scripted answerer: no model call.
  const s = scripted(question, facts);
  if (s) return { kind: "scripted", sentences: s.sentences, removed: 0 };

  // Everything below needs the model.
  if (!deps.llm)
    return none(
      "not_configured",
      "The AI assistant is not configured. Common questions are still answered from the record.",
    );
  if (deps.breakerOpen()) return none("unavailable", "The AI service is unavailable.");

  // 3. Cache.
  const key = [patientId, version, normalise(question), PROMPT_VERSION].join("|");
  const hit = deps.cache.get(key);
  if (hit && now() - hit.at < DAY_MS) return { ...hit.answer, cached: true };

  // 4. Daily quota.
  if (!(await deps.takeQuota())) return none("limit", "AI limit reached for today.");

  // 5-6. One call down the model chain.
  const result = await deps.llm([
    { role: "system", content: SYSTEM },
    { role: "user", content: userMessage(question, facts) },
  ]);
  for (const r of result.records) await deps.log(r);
  if (!result.ok) {
    if (result.reason === "cost") deps.openBreaker();
    return none("unavailable", "The AI service is unavailable.");
  }

  // 7. Output filter.
  const filtered: Filtered = filterReply(result.text, facts);
  if (filtered.kind === "blocked") return none("unavailable", "The AI service is unavailable.");
  if (filtered.kind === "no_answer")
    return none("no_answer", "The record doesn't contain that.", {
      removed: filtered.removed,
      model: result.model,
      ms: result.ms,
    });
  const out: Answer = {
    kind: "ai",
    sentences: filtered.sentences,
    removed: filtered.removed,
    model: result.model,
    ms: result.ms,
  };
  deps.cache.set(key, { at: now(), answer: out });
  return out;
}
