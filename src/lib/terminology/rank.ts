// Candidate ranking for SNOMED CT-AU coding. Pure and deterministic; relative imports only.
export type Target = { term: string; synonyms: string[] };
export type Candidate = { code: string; display: string; names: string[] }; // names: synonyms (not the FSN)
export type Coding = { code: string; display: string; confidence: number; rationale: string };

export const MIN_CODE = 0.5; // below this nothing is coded: "no code" beats a low-confidence guess
export const MIN_ALTERNATIVE = 0.3;
export const MAX_ALTERNATIVES = 4;

/**
 * Score tiers, highest first:
 *  1.00 the query is the preferred term       0.95 the query is a synonym
 *  0.90 an expansion of the query (an abbreviation or synonym listed in targets.json) is the preferred term or a synonym
 *  otherwise 0.8 x token overlap (Jaccard) between the query or an expansion and the best-matching name.
 * Ties: shorter display first (the more general concept), then code, so results are stable.
 */
export const SCORES = { preferred: 1, synonym: 0.95, expanded: 0.9, overlapWeight: 0.8 } as const;

// Australian and US spellings meet in the middle: anaemia/anemia, oesophagitis/esophagitis, oedema/edema.
export const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/ae/g, "e")
    .replace(/oe/g, "e")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const tokens = (s: string) => new Set(norm(s).split(" ").filter(Boolean));

function jaccard(a: Set<string>, b: Set<string>) {
  const shared = [...a].filter((t) => b.has(t)).length;
  return shared / (a.size + b.size - shared || 1);
}

/** The query plus, when it is a listed term, abbreviation or synonym, everything listed for that target. */
export function aliasesFor(query: string, targets: Target[]): { original: string; expansions: string[] } {
  const q = norm(query);
  const hit = targets.filter((t) => [t.term, ...t.synonyms].some((x) => norm(x) === q));
  const all = hit.flatMap((t) => [t.term, ...t.synonyms]).filter((x) => norm(x) !== q);
  return { original: query, expansions: [...new Set(all)] };
}

export function rank(query: string, expansions: string[], candidates: Candidate[]): Coding[] {
  const q = norm(query);
  const exp = expansions.map(norm);
  const scored = candidates.map((c) => {
    let best = { score: 0, why: "" };
    const consider = (score: number, why: string) => {
      if (score > best.score) best = { score, why };
    };
    const names = [{ n: c.display, preferred: true }, ...c.names.map((n) => ({ n, preferred: false }))];
    for (const { n, preferred } of names) {
      const nn = norm(n);
      if (nn === q) {
        consider(
          preferred ? SCORES.preferred : SCORES.synonym,
          `${preferred ? "Preferred term" : "Synonym"} "${n}" matches "${query}" exactly`,
        );
      } else if (exp.includes(nn)) {
        consider(SCORES.expanded, `"${n}" matches a listed expansion of "${query}"`);
      }
      for (const a of [q, ...exp]) {
        const j = jaccard(tokens(a), tokens(n));
        if (j > 0)
          consider(
            j * SCORES.overlapWeight,
            `Word overlap ${Math.round(j * 100)}% between "${a}" and "${n}"`,
          );
      }
    }
    return {
      code: c.code,
      display: c.display,
      confidence: Math.round(best.score * 100) / 100,
      rationale: best.why,
    };
  });
  return scored
    .filter((c) => c.confidence > 0)
    .sort(
      (a, b) =>
        b.confidence - a.confidence || a.display.length - b.display.length || a.code.localeCompare(b.code),
    );
}

/** Top result at or above MIN_CODE, plus up to four alternatives at or above MIN_ALTERNATIVE. */
export function pick(ranked: Coding[]): { best: Coding | null; alternatives: Coding[] } {
  const [first, ...rest] = ranked;
  if (!first || first.confidence < MIN_CODE) return { best: null, alternatives: [] };
  return {
    best: first,
    alternatives: rest.filter((c) => c.confidence >= MIN_ALTERNATIVE).slice(0, MAX_ALTERNATIVES),
  };
}
