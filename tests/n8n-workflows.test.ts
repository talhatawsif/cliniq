import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DIR = "n8n/workflows";
const files = readdirSync(DIR).filter((f) => f.endsWith(".json"));

describe("n8n workflow exports", () => {
  it("there are workflows to check", () => expect(files.length).toBeGreaterThanOrEqual(3));

  it.each(files)("%s holds no secret-looking strings", (f) => {
    const text = readFileSync(`${DIR}/${f}`, "utf8");
    const found = [
      ...(text.match(/sk-[A-Za-z0-9_-]{16,}/g) ?? []), // API keys
      ...(text.match(/\b[0-9a-f]{32,}\b/gi) ?? []), // long hex (keys, tokens)
      ...(text.match(/[A-Za-z0-9+/]{40,}={0,2}/g) ?? []), // long base64 blobs
      ...(text.match(/Bearer\s+[A-Za-z0-9._-]{12,}/g) ?? []),
      ...(text.match(/-----BEGIN [A-Z ]*PRIVATE KEY-----/g) ?? []),
      ...(text.match(/\b(password|secret|api[_-]?key)\b"\s*:\s*"[^"]{6,}"/gi) ?? []),
    ];
    expect(found).toEqual([]);
  });

  it.each(files)("%s refers to credentials by id and name only", (f) => {
    const wf = JSON.parse(readFileSync(`${DIR}/${f}`, "utf8")) as {
      nodes: { credentials?: Record<string, Record<string, unknown>> }[];
    };
    for (const n of wf.nodes) {
      for (const c of Object.values(n.credentials ?? {}))
        expect(Object.keys(c).sort()).toEqual(["id", "name"]);
    }
  });

  it("the HL7 and sweep workflows call the app, never the FHIR server", () => {
    for (const f of files) {
      const text = readFileSync(`${DIR}/${f}`, "utf8");
      expect(text).not.toMatch(/run\.app|8080\/fhir|\/fhir\//);
    }
  });
});
