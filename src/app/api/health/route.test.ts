import { describe, expect, it, vi } from "vitest";

async function health(fhir: () => Promise<unknown>) {
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
  vi.stubGlobal("fetch", async () => Response.json(1234));
  const { GET } = await import("./route");
  const res = await GET(new Request("https://app.example/api/health?deep=1"));
  return { status: res.status, body: await res.json() };
}

describe("deep health check", () => {
  it("a FHIR server that is still waking is a 200 (a keep-alive pinger must not see a failure)", async () => {
    const { FhirError } = await import("@/lib/fhir/client");
    const r = await health(async () => {
      throw new FhirError("timeout", "slow");
    });
    expect(r.status).toBe(200);
    expect(r.body.deep.fhir).toBe("waking");
  });
  it("a real failure is still a 503", async () => {
    const { FhirError } = await import("@/lib/fhir/client");
    const r = await health(async () => {
      throw new FhirError("http", "boom", 500);
    });
    expect(r.status).toBe(503);
    expect(r.body.deep.fhir).toBe("down");
  });
  it("an answering server is ok", async () => {
    expect((await health(async () => ({ resourceType: "Bundle" }))).body.deep.fhir).toBe("ok");
  });
});
