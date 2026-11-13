import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import targets from "../../../services/nlp/targets.json";
import { ACCEPTANCE, NONSENSE } from "./acceptance";
import { type Config, type Recorded, codeTerm, editionLabel, parseExpansion, queriesFor } from "./client";
import { type Candidate, aliasesFor, norm, pick, rank } from "./rank";

const recorded = JSON.parse(readFileSync("data/terminology/offline.json", "utf8")) as Recorded;
const offline: Config = { backend: "offline", recorded };
const cand = (code: string, display: string, names: string[] = []): Candidate => ({ code, display, names });

describe("offline backend (the M10 acceptance terms)", () => {
  it.each(ACCEPTANCE)("%s -> %s", async (query, code) => {
    const r = await codeTerm(query, offline, targets.targets);
    expect(r.best?.code).toBe(code);
    expect(r.backend).toBe("offline");
    expect(r.edition).toMatch(/^SNOMED CT-AU \d{8}$/);
    expect(r.system).toBe("http://snomed.info/sct");
    expect(r.alternatives.length).toBeLessThanOrEqual(4);
    expect(r.best?.rationale).toBeTruthy();
    expect(r.best!.confidence).toBeGreaterThan(0.5);
  });

  it("a nonsense term returns no code, not a low-confidence guess", async () => {
    const r = await codeTerm(NONSENSE, offline, targets.targets);
    expect(r.best).toBeNull();
    expect(r.alternatives).toEqual([]);
    expect(r.note).toContain("No code");
  });

  it("is deterministic", async () => {
    const a = await codeTerm("heart failure", offline, targets.targets);
    const b = await codeTerm("heart failure", offline, targets.targets);
    expect(a).toEqual(b);
  });
});

describe("offline data scope", () => {
  it("holds recorded answers for the acceptance terms only (no wider SNOMED CT-AU content is committed)", () => {
    const allowed = new Set(
      [...ACCEPTANCE.map((a) => a[0]), NONSENSE]
        .flatMap((q) => queriesFor(q, targets.targets))
        .map((q) => q.toLowerCase()),
    );
    expect(Object.keys(recorded.expansions).filter((k) => !allowed.has(k))).toEqual([]);
    expect(Object.values(recorded.expansions).every((c) => c.length <= 10)).toBe(true);
  });
});

describe("ranking", () => {
  it("prefers an exact preferred term over a synonym over word overlap", () => {
    const r = rank(
      "anaemia",
      [],
      [cand("3", "Macrocytic anaemia"), cand("2", "Other", ["Anemia"]), cand("1", "Anaemia")],
    );
    expect(r.map((c) => [c.code, c.confidence])).toEqual([
      ["1", 1],
      ["2", 0.95],
      ["3", 0.4],
    ]);
  });

  it("treats Australian and US spellings alike", () => {
    expect(norm("Oesophagitis")).toBe(norm("esophagitis"));
    expect(rank("esophagitis", [], [cand("1", "Oesophagitis")])[0].confidence).toBe(1);
  });

  it("an expansion from targets.json scores 0.9", () => {
    const { expansions } = aliasesFor("T2DM", targets.targets);
    expect(expansions).toContain("type 2 diabetes mellitus");
    expect(
      rank("T2DM", expansions, [cand("44054006", "Type 2 diabetes", ["Type 2 diabetes mellitus"])])[0]
        .confidence,
    ).toBe(0.9);
  });

  it("ties go to the shorter display, then the lower code", () => {
    const r = rank("x y", [], [cand("9", "x y z"), cand("2", "x y q"), cand("1", "x y p")]);
    expect(r.map((c) => c.code)).toEqual(["1", "2", "9"]);
  });

  it("nothing is coded below 0.5, and alternatives need 0.3", () => {
    expect(pick(rank("xyzzy", [], [cand("1", "49,XYYYY syndrome")])).best).toBeNull();
    const weak = pick(
      rank(
        "heart failure",
        [],
        [cand("1", "Heart failure"), cand("2", "Fetal heart failure"), cand("3", "Heart")],
      ),
    );
    expect(weak.best?.code).toBe("1");
    expect(weak.alternatives.map((c) => c.code)).toEqual(["2", "3"]);
  });

  it("caps alternatives at four", () => {
    const many = Array.from({ length: 9 }, (_, i) => cand(String(i), `Heart failure type ${i}`));
    expect(pick(rank("heart failure", [], [cand("0", "Heart failure"), ...many])).alternatives).toHaveLength(
      4,
    );
  });
});

describe("parsing", () => {
  it("reads the edition and drops the fully specified name", () => {
    expect(
      editionLabel("http://snomed.info/sct|http://snomed.info/sct/32506021000036107/version/20261031"),
    ).toBe("SNOMED CT-AU 20261031");
    const r = parseExpansion({
      expansion: {
        parameter: [
          {
            name: "version",
            valueUri: "http://snomed.info/sct|http://snomed.info/sct/32506021000036107/version/20261031",
          },
        ],
        contains: [
          {
            code: "38341003",
            display: "Hypertension",
            designation: [
              { use: { code: "900000000000003001" }, value: "Hypertensive disorder (disorder)" },
              { use: { code: "900000000000013009" }, value: "HTN" },
            ],
          },
        ],
      },
    });
    expect(r.candidates[0].names).toEqual(["HTN"]);
    expect(r.edition).toBe("SNOMED CT-AU 20261031");
  });
});

describe("configuration and fallback", () => {
  afterEach(() => vi.unstubAllGlobals());
  async function load(env: Record<string, string | undefined>) {
    vi.resetModules();
    vi.doMock("@/lib/env", () => ({ env }));
    return import("./index");
  }

  it("no settings means offline; a base URL means the live server; credentials mean NCTS", async () => {
    expect((await load({})).configured().backend).toBe("offline");
    expect((await load({ TERMINOLOGY_BASE_URL: "https://x.example/fhir" })).configured().backend).toBe(
      "csiro",
    );
    expect(
      (await load({ TERMINOLOGY_CLIENT_ID: "a", TERMINOLOGY_CLIENT_SECRET: "b" })).configured().backend,
    ).toBe("ncts");
  });

  it("a live server that fails is replaced by the offline subset, and the result says so", async () => {
    const { codeCondition } = await load({ TERMINOLOGY_BASE_URL: "https://x.example/fhir" });
    vi.stubGlobal("fetch", async () => new Response("down", { status: 503 }));
    const r = await codeCondition("asthma");
    expect(r.backend).toBe("offline");
    expect(r.fallback).toContain("did not answer");
    expect(r.best?.code).toBe("195967001");
  });
});
