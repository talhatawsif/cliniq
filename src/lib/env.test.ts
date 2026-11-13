import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

describe("parseEnv", () => {
  it("reads valid settings and treats empty values as unset", () => {
    const { env, flags, invalid } = parseEnv({
      FHIR_BASE_URL: "http://localhost:8080/fhir",
      OPENROUTER_API_KEY: "",
    });
    expect(env.FHIR_BASE_URL).toBe("http://localhost:8080/fhir");
    expect(env.FHIR_AUTH).toBe("none");
    expect(flags).toMatchObject({ fhir: true, ai: false });
    expect(invalid).toEqual([]);
  });

  it("ignores a malformed setting instead of throwing, and names it", () => {
    const { env, flags, invalid } = parseEnv({
      FHIR_BASE_URL: "localhost:8080/fhir",
      FHIR_AUTH: "iam",
      NLP_SERVICE_URL: "x",
    });
    expect(invalid.sort()).toEqual(["FHIR_AUTH", "FHIR_BASE_URL"]);
    expect(env.FHIR_BASE_URL).toBeUndefined();
    expect(env.FHIR_AUTH).toBe("none");
    expect(flags).toMatchObject({ fhir: false, nlp: true });
  });
});
