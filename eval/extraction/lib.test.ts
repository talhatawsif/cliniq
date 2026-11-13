import { describe, expect, it } from "vitest";
import { type Span, assertionOf, assertionScores, match, prf } from "./lib";

const s = (start: number, end: number, assertion: Span["assertion"] = "affirmed"): Span => ({
  start,
  end,
  text: "x",
  assertion,
});

describe("extraction scoring", () => {
  it("matches overlapping spans one-to-one and reports misses and extras", () => {
    const m = match([s(0, 10), s(20, 30), s(40, 50)], [s(0, 9), s(21, 30), s(60, 70)]);
    expect(m.matched).toHaveLength(2);
    expect(m.missed).toEqual([s(40, 50)]);
    expect(m.spurious).toEqual([s(60, 70)]);
  });
  it("a span that overlaps by less than half is not a match", () => {
    expect(match([s(0, 10)], [s(8, 30)]).matched).toHaveLength(0);
  });
  it("one prediction cannot match two gold spans", () => {
    expect(match([s(0, 10), s(2, 10)], [s(0, 10)]).matched).toHaveLength(1);
  });
  it("precision, recall and F1", () => {
    expect(prf(8, 2, 2)).toMatchObject({ precision: 0.8, recall: 0.8 });
    expect(prf(0, 0, 0).f1).toBe(0);
  });
  it("assertion scores count only matched pairs, per type", () => {
    const pairs = [
      { gold: s(0, 1, "negated"), predicted: s(0, 1, "negated") },
      { gold: s(2, 3, "negated"), predicted: s(2, 3, "affirmed") },
      { gold: s(4, 5, "affirmed"), predicted: s(4, 5, "affirmed") },
    ];
    const r = assertionScores(pairs);
    expect(r.negated).toMatchObject({ tp: 1, fp: 0, fn: 1 });
    expect(r.affirmed).toMatchObject({ tp: 1, fp: 1, fn: 0 });
  });
  it("uses the pipeline's precedence", () => {
    const f = { negated: false, family: false, historical: false, hypothetical: false, uncertain: false };
    expect(assertionOf({ ...f, negated: true, family: true })).toBe("negated");
    expect(assertionOf({ ...f, historical: true })).toBe("historical");
    expect(assertionOf(f)).toBe("affirmed");
  });
});
