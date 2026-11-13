import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

describe("fhirAuthHeader", () => {
  it("mints a separate token for each audience", async () => {
    const { privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    vi.resetModules();
    vi.doMock("@/lib/env", () => ({
      env: {
        FHIR_AUTH: "gcp-iam",
        GCP_SA_KEY: JSON.stringify({ client_email: "a@b.iam", private_key: privateKey }),
      },
    }));
    const audiences: string[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: { body: URLSearchParams }) => {
      const claims = JSON.parse(
        Buffer.from(init.body.get("assertion")!.split(".")[1], "base64url").toString(),
      );
      audiences.push(claims.target_audience);
      return Response.json({ id_token: `token-for-${claims.target_audience}` });
    });
    const { fhirAuthHeader } = await import("./auth");
    expect((await fhirAuthHeader("https://fhir.example")).Authorization).toBe(
      "Bearer token-for-https://fhir.example",
    );
    expect((await fhirAuthHeader("https://nlp.example")).Authorization).toBe(
      "Bearer token-for-https://nlp.example",
    );
    await fhirAuthHeader("https://fhir.example"); // cached
    expect(audiences).toEqual(["https://fhir.example", "https://nlp.example"]);
    vi.unstubAllGlobals();
  });
});
