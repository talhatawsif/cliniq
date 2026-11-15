import { describe, expect, it, vi } from "vitest";

async function health(fhir: () => Promise<unknown>, rest: (url: string) => unknown = () => 1234) {
  vi.resetModules();
  vi.doMock("@/lib/env", () => ({
    env: { NEXT_PUBLIC_SUPABASE_URL: "https://x.example", SUPABASE_SECRET_KEY: "k" },
    flags: { supabase: true },
    invalidSettings: [],
  }));
  vi.doMock("@/lib/fhir/client", async () => {
    const real = await vi.importActual<typeof import("@/lib/fhir/client")>("@/lib/fhir/client");
    return { ...real, fhirFetch: fhir };
  });
  vi.stubGlobal("fetch", async (url: string) => Response.json(rest(String(url))));
  const { GET } = await import("./route");
  const res = await GET(new Request("https://app.example/api/health?deep=1"));
  return { status: res.status, body: await res.json() };
}

describe("deep health check", () => {
  it("a FHIR server that is still waking is a 200 (a keep-alive pinger must not see a failure)", async () => {
    const r = await health(async () => {
      // Imported here, after the module reset, so it is the same class the route sees (instanceof).
      const { FhirError } = await import("@/lib/fhir/client");
      throw new FhirError("timeout", "slow");
    });
    expect(r.status).toBe(200);
    expect(r.body.deep.fhir).toBe("waking");
  });
  it("a real failure is still a 503", async () => {
    const r = await health(async () => {
      const { FhirError } = await import("@/lib/fhir/client");
      throw new FhirError("http", "boom", 500);
    });
    expect(r.status).toBe(503);
    expect(r.body.deep.fhir).toBe("down");
  });
  it("an answering server is ok", async () => {
    expect((await health(async () => ({ resourceType: "Bundle" }))).body.deep.fhir).toBe("ok");
  });
  it("reports today's model calls and the latest outcome per model", async () => {
    const now = new Date();
    const old = new Date(now.getTime() - 3 * 86_400_000).toISOString();
    const rows = [
      { model: "a:free", outcome: "ok", at: now.toISOString() },
      { model: "b:free", outcome: "timeout", at: now.toISOString() },
      { model: "a:free", outcome: "error", at: old },
    ];
    const r = await health(
      async () => ({ resourceType: "Bundle" }),
      (url) => (url.includes("llm_calls") ? rows : 1234),
    );
    expect(r.body.deep.assistant).toEqual({
      callsToday: 2,
      lastByModel: {
        "a:free": { outcome: "ok", at: rows[0].at },
        "b:free": { outcome: "timeout", at: rows[1].at },
      },
    });
  });
  it("leaves the assistant out when its query fails, without degrading the check", async () => {
    const r = await health(async () => ({ resourceType: "Bundle" })); // the stub answers 1234, not a list
    expect(r.status).toBe(200);
    expect(r.body.deep.assistant).toBeNull();
  });
});
