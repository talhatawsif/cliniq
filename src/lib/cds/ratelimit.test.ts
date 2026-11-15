import { describe, expect, it } from "vitest";
import { CDS_LIMIT, rateLimited } from "./ratelimit";

describe("rateLimited", () => {
  it("allows the limit, refuses the next, and is per caller and per minute", () => {
    const t = 1_000_000;
    for (let i = 0; i < CDS_LIMIT; i++) expect(rateLimited("a", t)).toBe(false);
    expect(rateLimited("a", t)).toBe(true);
    expect(rateLimited("b", t)).toBe(false);
    expect(rateLimited("a", t + 60_001)).toBe(false);
  });
});
