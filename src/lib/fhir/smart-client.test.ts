import { afterEach, describe, expect, it, vi } from "vitest";

const session = {
  token: "SMART-TOKEN",
  iss: "https://launch.smarthealthit.org/v/r4/fhir",
  patient: "p1",
  exp: Date.now() / 1000 + 3600,
};

async function load(smart: typeof session | null) {
  vi.resetModules();
  vi.doMock("@/lib/env", () => ({
    env: { FHIR_BASE_URL: "https://own.example/fhir", FHIR_AUTH: "gcp-iam" },
  }));
  vi.doMock("@/lib/smart/session", () => ({ smartSession: async () => smart }));
  const ownAuth = vi.fn(async () => ({ Authorization: "Bearer OWN-GOOGLE-TOKEN" }));
  vi.doMock("@/lib/fhir/auth", () => ({ fhirAuthHeader: ownAuth }));
  return { ...(await import("./client")), ownAuth };
}
afterEach(() => vi.unstubAllGlobals());

describe("SMART mode in the FHIR client", () => {
  it("reads from the launching server with the user's token and never sends ClinIQ's own token there", async () => {
    const { fhirFetch, ownAuth } = await load(session);
    const calls: { url: string; auth: string }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: { headers: Record<string, string> }) => {
      calls.push({ url, auth: init.headers.Authorization });
      return Response.json({ resourceType: "Patient", id: "p1" });
    });
    await fhirFetch("Patient/p1");
    expect(calls).toEqual([
      { url: "https://launch.smarthealthit.org/v/r4/fhir/Patient/p1", auth: "Bearer SMART-TOKEN" },
    ]);
    expect(ownAuth).not.toHaveBeenCalled();
  });

  it("outside SMART mode it uses ClinIQ's own server and token", async () => {
    const { fhirFetch } = await load(null);
    const calls: { url: string; auth: string }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: { headers: Record<string, string> }) => {
      calls.push({ url, auth: init.headers.Authorization });
      return Response.json({});
    });
    await fhirFetch("Patient/p1");
    expect(calls).toEqual([{ url: "https://own.example/fhir/Patient/p1", auth: "Bearer OWN-GOOGLE-TOKEN" }]);
  });

  it("refuses to write in SMART mode", async () => {
    const { fhirPost } = await load(session);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await expect(fhirPost("", { resourceType: "Bundle" })).rejects.toMatchObject({
      message: "smart-read-only",
      status: 403,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
