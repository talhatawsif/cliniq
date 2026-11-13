import { beforeEach, describe, expect, it, vi } from "vitest";

const write = vi.fn(async () => ({
  resourceType: "Bundle",
  type: "transaction-response",
  entry: [{}, { response: { location: "Condition/c9/_history/1" } }],
}));
const validate = vi.fn(async (): Promise<string[]> => []);
const upsert = vi.fn(async () => ({ error: null }));

vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => {}) }));
vi.mock("@/lib/supabase", () => ({ admin: () => ({ from: () => ({ upsert }) }) }));
vi.mock("@/lib/fhir/write", () => ({ validateBundle: validate, writeBundle: write, createdId: () => "c9" }));
vi.mock("@/lib/fhir/client", () => ({
  fhirFetch: async () => ({
    id: "sample-x",
    subject: { reference: "Patient/p1" },
    content: [{ attachment: { data: Buffer.from("PMHx: HTN. Denies chest pain.").toString("base64") } }],
  }),
  fhirSearch: async () => [],
}));
const entity = (over: object) => ({
  text: "HTN",
  start: 6,
  end: 9,
  term: "hypertension",
  section: "x",
  negated: false,
  family: false,
  historical: false,
  hypothetical: false,
  uncertain: false,
  ...over,
});
vi.mock("@/lib/nlp", () => ({
  extractEntities: async () => ({
    engine: "medspacy",
    entities: [entity({}), entity({ text: "chest pain", start: 19, end: 29, negated: true })],
  }),
}));
vi.mock("@/lib/terminology", () => ({
  codeCondition: async () => ({
    query: "HTN",
    best: { code: "38341003", display: "Hypertension", confidence: 0.9, rationale: "r" },
    alternatives: [],
    system: "http://snomed.info/sct",
    edition: "SNOMED CT-AU 20261031",
    backend: "offline",
  }),
}));

beforeEach(() => vi.clearAllMocks());

describe("pipeline run", () => {
  it("W6: a negated entity is shown with its reason and never coded or written", async () => {
    const { runPipeline } = await import("./run");
    const r = await runPipeline({ docId: "sample-x", dryRun: false, userId: "u" });
    expect(r.entities.find((e) => e.text === "chest pain")).toMatchObject({
      outcome: "skip",
      reason: "negated",
    });
    expect(r.written).toHaveLength(1);
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it("W4: when $validate fails nothing is written and the reason is shown", async () => {
    validate.mockResolvedValueOnce(["Condition.subject: minimum required = 1"]);
    const { runPipeline } = await import("./run");
    const r = await runPipeline({ docId: "sample-x", dryRun: false, userId: "u" });
    expect(write).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
    expect(r.written).toEqual([]);
    expect(r.entities[0]).toMatchObject({ outcome: "skip" });
    expect(r.entities[0].reason).toContain("FHIR validation failed");
  });

  it("a dry run validates but writes nothing, and reports timings for each step", async () => {
    const { runPipeline } = await import("./run");
    const r = await runPipeline({ docId: "sample-x", dryRun: true, userId: "u" });
    expect(validate).toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(r.steps.map((s) => s.name)).toEqual([
      "Note",
      "Extract",
      "Problem list",
      "Code",
      "Validate and write",
    ]);
    expect(r.steps.every((s) => typeof s.ms === "number")).toBe(true);
  });
});
