import { afterEach, describe, expect, it, vi } from "vitest";
import { FhirError, fhirFetch, fhirSearch } from "./client";
import { getPatient } from "./index";

const BASE = "http://fhir.test/fhir";
const opts = { baseUrl: BASE, retryDelayMs: 0 };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

function stubFetch(handler: (url: string) => Response | Promise<Response>) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    calls.push(url);
    return handler(url);
  });
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("fhirFetch", () => {
  it("reports a missing base URL as not-configured without calling the network", async () => {
    const calls = stubFetch(() => json(200, {}));
    await expect(fhirFetch("Patient", { baseUrl: "" })).rejects.toMatchObject({ kind: "not-configured" });
    expect(calls).toHaveLength(0);
  });

  it("returns null for 404 and 410", async () => {
    stubFetch(() => json(404, {}));
    expect(await fhirFetch("Patient/x", opts)).toBeNull();
  });

  it("retries while the server wakes up, then succeeds", async () => {
    let n = 0;
    const calls = stubFetch(() => (++n < 3 ? json(503, {}) : json(200, { id: "p1" })));
    expect(await fhirFetch("Patient/p1", opts)).toEqual({ id: "p1" });
    expect(calls).toHaveLength(3);
  });

  it("gives up after the retries with an 'unavailable' error", async () => {
    const calls = stubFetch(() => json(503, {}));
    await expect(fhirFetch("Patient", opts)).rejects.toMatchObject({ kind: "unavailable", status: 503 });
    expect(calls).toHaveLength(3);
  });

  it("does not retry a client error", async () => {
    const calls = stubFetch(() => json(400, {}));
    await expect(fhirFetch("Patient?bad", opts)).rejects.toMatchObject({ kind: "http", status: 400 });
    expect(calls).toHaveLength(1);
  });

  it("maps a timeout and a network failure to typed errors", async () => {
    stubFetch(() => {
      throw Object.assign(new Error("timed out"), { name: "TimeoutError" });
    });
    await expect(fhirFetch("Patient", { ...opts, retries: 0 })).rejects.toMatchObject({ kind: "timeout" });
    stubFetch(() => {
      throw new TypeError("fetch failed");
    });
    await expect(fhirFetch("Patient", { ...opts, retries: 0 })).rejects.toBeInstanceOf(FhirError);
  });
});

describe("fhirSearch", () => {
  it("follows next links and skips the outcome entry", async () => {
    stubFetch((url) =>
      url.includes("page=2")
        ? json(200, {
            entry: [
              { resource: { resourceType: "Condition", id: "c2" } },
              { resource: { resourceType: "OperationOutcome" }, search: { mode: "outcome" } },
            ],
          })
        : json(200, {
            entry: [{ resource: { resourceType: "Condition", id: "c1" } }],
            link: [{ relation: "next", url: `${BASE}?page=2` }],
          }),
    );
    const found = await fhirSearch("Condition?patient=p1", opts);
    expect(found.map((r) => r.id)).toEqual(["c1", "c2"]);
  });

  it("refuses a next link to another host", async () => {
    stubFetch(() => json(200, { link: [{ relation: "next", url: "http://evil.test/fhir?page=2" }] }));
    await expect(fhirSearch("Condition", opts)).rejects.toMatchObject({ kind: "bad-link" });
  });

  it("stops at maxPages", async () => {
    const calls = stubFetch(() => json(200, { link: [{ relation: "next", url: `${BASE}?more` }] }));
    await fhirSearch("Observation", { ...opts, maxPages: 2 });
    expect(calls).toHaveLength(2);
  });
});

describe("getPatient", () => {
  it("rejects ids that could change the query, without calling the network", async () => {
    const calls = stubFetch(() => json(200, {}));
    expect(await getPatient("1&_revinclude=*")).toBeNull();
    expect(await getPatient("../x")).toBeNull();
    expect(calls).toHaveLength(0);
  });
});
