// Scoring for the extraction evaluation. Pure functions, tested in src/lib/... via eval/extraction/lib.test.ts.
export const ASSERTIONS = [
  "affirmed",
  "negated",
  "family",
  "historical",
  "hypothetical",
  "uncertain",
] as const;
export type Assertion = (typeof ASSERTIONS)[number];
export type Span = { start: number; end: number; text: string; assertion: Assertion; snomed?: string | null };

/** Same precedence as the pipeline's rule for which entities may be written. */
export function assertionOf(e: {
  negated: boolean;
  family: boolean;
  historical: boolean;
  hypothetical: boolean;
  uncertain: boolean;
}): Assertion {
  if (e.negated) return "negated";
  if (e.family) return "family";
  if (e.hypothetical) return "hypothetical";
  if (e.uncertain) return "uncertain";
  if (e.historical) return "historical";
  return "affirmed";
}

const iou = (a: Span, b: Span) => {
  const inter = Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
  return inter / (a.end - a.start + (b.end - b.start) - inter);
};

/** One-to-one matching, best overlap first; a pair needs an intersection over union of at least 0.5. */
export function match(gold: Span[], predicted: Span[]) {
  const pairs: { g: number; p: number; score: number }[] = [];
  gold.forEach((g, gi) =>
    predicted.forEach((p, pi) =>
      iou(g, p) >= 0.5 ? pairs.push({ g: gi, p: pi, score: iou(g, p) }) : undefined,
    ),
  );
  pairs.sort((x, y) => y.score - x.score || x.g - y.g || x.p - y.p);
  const usedG = new Set<number>();
  const usedP = new Set<number>();
  const matched: { gold: Span; predicted: Span }[] = [];
  for (const { g, p } of pairs) {
    if (usedG.has(g) || usedP.has(p)) continue;
    usedG.add(g);
    usedP.add(p);
    matched.push({ gold: gold[g], predicted: predicted[p] });
  }
  return {
    matched,
    missed: gold.filter((_, i) => !usedG.has(i)),
    spurious: predicted.filter((_, i) => !usedP.has(i)),
  };
}

export const prf = (tp: number, fp: number, fn: number) => {
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  return {
    precision,
    recall,
    f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0,
    tp,
    fp,
    fn,
  };
};

/** Per assertion type: a predicted type is right for a matched pair when it equals the gold type. */
export function assertionScores(matched: { gold: Span; predicted: Span }[]) {
  return Object.fromEntries(
    ASSERTIONS.map((a) => {
      const tp = matched.filter((m) => m.gold.assertion === a && m.predicted.assertion === a).length;
      const fp = matched.filter((m) => m.gold.assertion !== a && m.predicted.assertion === a).length;
      const fn = matched.filter((m) => m.gold.assertion === a && m.predicted.assertion !== a).length;
      return [a, prf(tp, fp, fn)];
    }),
  ) as Record<Assertion, ReturnType<typeof prf>>;
}
