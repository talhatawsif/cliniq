import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

const note = "05-consult-cardiology.txt";
const text = readFileSync(`data/sample-notes/${note}`, "utf8");

async function load(url?: string) {
  vi.resetModules();
  vi.doMock("@/lib/env", () => ({ env: { NLP_SERVICE_URL: url, FHIR_AUTH: "none" } }));
  return import("./index");
}
afterEach(() => vi.unstubAllGlobals());

describe("NLP client", () => {
  it("without NLP_SERVICE_URL it uses the saved output and says so", async () => {
    const { extractEntities } = await load();
    const r = await extractEntities(text, note);
    expect(r.engine).toBe("precomputed");
    expect(r.reason).toContain("NLP_SERVICE_URL");
    expect(r.entities.length).toBeGreaterThan(5);
    for (const e of r.entities) expect(text.slice(e.start, e.end)).toBe(e.text);
  });

  it("with the service it labels the result medspacy", async () => {
    const { extractEntities } = await load("https://nlp.example");
    vi.stubGlobal("fetch", async () => Response.json({ engine: "medspacy", entities: [] }));
    expect((await extractEntities("x", note)).engine).toBe("medspacy");
  });

  it("falls back to the saved output when the service is down, and fails for unknown text", async () => {
    const { extractEntities } = await load("https://nlp.example");
    vi.stubGlobal("fetch", async () => new Response("no", { status: 503 }));
    expect((await extractEntities(text, note)).engine).toBe("precomputed");
    await expect(extractEntities("some other note")).rejects.toThrow(/no precomputed output/);
  });

  it("a malformed service answer is treated as down", async () => {
    const { extractEntities } = await load("https://nlp.example");
    vi.stubGlobal("fetch", async () => Response.json({ entities: [{ text: 1 }] }));
    expect((await extractEntities(text, note)).engine).toBe("precomputed");
  });

  it("only entities with no context flag are affirmed", async () => {
    const { isAffirmed } = await load();
    const base = {
      text: "a",
      start: 0,
      end: 1,
      term: "a",
      section: "x",
      negated: false,
      family: false,
      historical: false,
      hypothetical: false,
      uncertain: false,
    };
    expect(isAffirmed(base)).toBe(true);
    expect(isAffirmed({ ...base, uncertain: true })).toBe(false);
  });
});
