// The real guardrail: checks the model's reply against the facts it was given. Does not trust the model.
import type { Fact } from "./facts";

export const CANARY = "ZX-CANARY-7731";
export type Sentence = { text: string; ids: string[] };
export type Filtered =
  | { kind: "blocked" } // the canary leaked: the whole reply is discarded
  | { kind: "no_answer"; removed: number }
  | { kind: "ok"; sentences: Sentence[]; removed: number };

// Citations may be followed by a full stop, which models often add after the brackets.
const TRAILING = /((?:\s*\[F\d+\])+)[\s.;]*$/;
const stripIds = (s: string) => s.replace(/\[F\d+\]/g, "");
// A date (10/11/2026, 11/2026) is one token: its parts must not count as support for a value such as "11".
const numbers = (s: string): string[] =>
  stripIds(s).match(/\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}\/\d{4}|\d+(?:\.\d+)?/g) ?? [];

/**
 * One sentence per line, each ending with fact ids. A sentence is kept only if it cites at least one id,
 * every cited id is in this request's fact list, and every number and date in it appears in a cited fact.
 */
export function filterReply(reply: string, facts: Fact[]): Filtered {
  if (reply.includes(CANARY)) return { kind: "blocked" };
  const trimmed = reply.trim();
  if (trimmed === "NO_ANSWER") return { kind: "no_answer", removed: 0 };
  const byId = new Map(facts.map((f) => [f.id, f]));
  const kept: Sentence[] = [];
  let removed = 0;
  for (const raw of trimmed.split("\n")) {
    const line = raw.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim();
    if (!line || line === "NO_ANSWER") continue;
    const cited = TRAILING.exec(line);
    const ids = cited ? [...cited[1].matchAll(/\[(F\d+)\]/g)].map((m) => m[1]) : [];
    const body = cited ? line.slice(0, cited.index).trim() : line;
    const evidence = ids.map((id) => byId.get(id)?.text ?? "").join(" ");
    const supported =
      ids.length > 0 &&
      ids.every((id) => byId.has(id)) &&
      numbers(body).every((n) => numbers(evidence).includes(n));
    if (supported && body) kept.push({ text: body, ids: [...new Set(ids)] });
    else removed++;
  }
  return kept.length ? { kind: "ok", sentences: kept, removed } : { kind: "no_answer", removed };
}
