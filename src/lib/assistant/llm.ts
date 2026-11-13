// OpenRouter client for the free-model chain. No app imports: the key and model list are passed in.
import { assertFreeModel } from "./models";

export type Message = { role: "system" | "user"; content: string };
export type CallOutcome = "ok" | "empty" | "timeout" | "rate_limited" | "error";
export type CallRecord = {
  model: string;
  latencyMs: number;
  promptTokens?: number;
  completionTokens?: number;
  cost: number;
  outcome: CallOutcome;
};
export type ChainResult =
  | { ok: true; text: string; model: string; ms: number; records: CallRecord[] }
  | { ok: false; reason: "all_failed" | "cost"; records: CallRecord[] };

const TIMEOUT_MS = 20_000;

/**
 * Tries each model in order. A reply that reports any cost opens the breaker: the reply is discarded and the caller
 * must stop using the LLM until the app is redeployed.
 */
export async function callChain(opts: {
  key: string;
  models: string[];
  messages: Message[];
  fetchImpl?: typeof fetch;
}): Promise<ChainResult> {
  const f = opts.fetchImpl ?? fetch;
  const models = opts.models.map(assertFreeModel); // throws before any network call
  const records: CallRecord[] = [];
  for (const model of models) {
    const t0 = Date.now();
    const record = (outcome: CallOutcome, extra: Partial<CallRecord> = {}) =>
      records.push({ model, latencyMs: Date.now() - t0, cost: 0, outcome, ...extra });
    try {
      const res = await f("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${opts.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, temperature: 0.1, max_tokens: 800, messages: opts.messages }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.status === 429) {
        record("rate_limited");
        continue;
      }
      if (!res.ok) {
        record("error");
        continue;
      }
      const j = (await res.json()) as {
        choices?: { message?: { content?: string | null } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
      };
      const cost = j.usage?.cost ?? 0;
      const extra = {
        cost,
        promptTokens: j.usage?.prompt_tokens,
        completionTokens: j.usage?.completion_tokens,
      };
      if (cost > 0) {
        record("error", extra);
        return { ok: false, reason: "cost", records };
      }
      const text = j.choices?.[0]?.message?.content?.trim() ?? "";
      if (!text) {
        record("empty", extra);
        continue;
      }
      record("ok", extra);
      return { ok: true, text, model, ms: Date.now() - t0, records };
    } catch (e) {
      record(e instanceof Error && e.name === "TimeoutError" ? "timeout" : "error");
    }
  }
  return { ok: false, reason: "all_failed", records };
}
