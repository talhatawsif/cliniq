import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const rows = readFileSync("docs/CLINICAL-SAFETY.md", "utf8")
  .split("\n")
  .filter((l) => /^\| \d+ \|/.test(l))
  .map((l) => l.split("|").map((c) => c.trim()));

describe("hazard log", () => {
  it("has at least ten hazards", () => expect(rows.length).toBeGreaterThanOrEqual(10));

  it.each(rows.map((r) => [r[1], r]))("hazard %s names evidence that exists in the repository", (_n, r) => {
    const evidence = r[6] as string; // columns: "", #, hazard, cause, effect, mitigation, evidence, residual
    const paths = [...evidence.matchAll(/`([^`]+)`/g)].map((m) => m[1]).filter((p) => /[./]/.test(p));
    expect(paths.length).toBeGreaterThan(0);
    for (const p of paths) expect(existsSync(p), `${p} does not exist`).toBe(true);
    expect(r[5], "mitigation").toBeTruthy();
    expect(r[7], "residual risk").toBeTruthy();
  });
});
