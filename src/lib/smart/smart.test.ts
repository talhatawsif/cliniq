import { describe, expect, it } from "vitest";
import {
  authorizeUrl,
  checkConfig,
  checkIssuer,
  chooseScopes,
  newPkce,
  newState,
  pkceChallenge,
  stateMatches,
} from "./flow";
import { open, seal } from "./seal";

describe("PKCE", () => {
  it("matches the RFC 7636 example", () => {
    expect(pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });
  it("makes a fresh verifier of valid length whose challenge verifies", () => {
    const a = newPkce();
    const b = newPkce();
    expect(a.verifier).not.toBe(b.verifier);
    expect(a.verifier.length).toBeGreaterThanOrEqual(43);
    expect(a.verifier.length).toBeLessThanOrEqual(128);
    expect(a.verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(pkceChallenge(a.verifier)).toBe(a.challenge);
  });
});

describe("state", () => {
  it("is rejected on mismatch, on missing values, and accepted when equal", () => {
    const s = newState();
    expect(stateMatches(s, s)).toBe(true);
    expect(stateMatches(newState(), s)).toBe(false);
    expect(stateMatches(null, s)).toBe(false);
    expect(stateMatches(s, undefined)).toBe(false);
    expect(stateMatches(s + "x", s)).toBe(false);
  });
});

describe("issuer and discovery", () => {
  it("only the SMART sandbox is allowed", () => {
    expect(checkIssuer("https://launch.smarthealthit.org/v/r4/fhir")).toBe(
      "https://launch.smarthealthit.org/v/r4/fhir",
    );
    expect(checkIssuer("https://launch.smarthealthit.org/v/r4/fhir/")).toBe(
      "https://launch.smarthealthit.org/v/r4/fhir",
    );
    for (const bad of [
      "https://evil.example/fhir",
      "http://launch.smarthealthit.org/v/r4/fhir",
      "https://launch.smarthealthit.org.evil.example/x",
      "nonsense",
      "",
      null,
      undefined,
    ]) {
      expect(checkIssuer(bad)).toBeNull();
    }
  });
  it("discovery endpoints on another host are refused", () => {
    const iss = "https://launch.smarthealthit.org/v/r4/fhir";
    expect(
      checkConfig(iss, {
        authorization_endpoint: "https://launch.smarthealthit.org/a",
        token_endpoint: "https://launch.smarthealthit.org/t",
      }),
    ).not.toBeNull();
    expect(
      checkConfig(iss, {
        authorization_endpoint: "https://evil.example/a",
        token_endpoint: "https://launch.smarthealthit.org/t",
      }),
    ).toBeNull();
    expect(checkConfig(iss, {})).toBeNull();
  });
});

describe("authorize URL and scopes", () => {
  const config = {
    authorization_endpoint: "https://launch.smarthealthit.org/v/r4/auth/authorize",
    token_endpoint: "t",
    capabilities: ["permission-v2"],
  };
  it("uses .rs scopes when the server supports v2, else .read", () => {
    expect(chooseScopes(config, false)).toBe("openid fhirUser launch/patient patient/*.rs");
    expect(chooseScopes({ capabilities: [] }, true)).toBe("openid fhirUser launch patient/*.read");
  });
  it("carries PKCE, state, aud and the EHR launch token", () => {
    const { challenge } = newPkce();
    const u = new URL(
      authorizeUrl({
        config,
        clientId: "cliniq",
        redirectUri: "https://app.example/smart/callback",
        scope: "openid",
        state: "S",
        challenge,
        iss: "https://launch.smarthealthit.org/v/r4/fhir",
        launch: "L1",
      }),
    );
    expect(Object.fromEntries(u.searchParams)).toMatchObject({
      response_type: "code",
      client_id: "cliniq",
      state: "S",
      aud: "https://launch.smarthealthit.org/v/r4/fhir",
      code_challenge: challenge,
      code_challenge_method: "S256",
      launch: "L1",
    });
  });
});

describe("sealed cookies", () => {
  const secret = "a-long-test-secret-value-1234567890";
  it("round-trips, and the token is not readable in the cookie value", () => {
    const sealed = seal({ token: "ACCESS-TOKEN-123" }, secret, "session");
    expect(sealed).not.toContain("ACCESS");
    expect(Buffer.from(sealed, "base64url").toString("utf8")).not.toContain("ACCESS-TOKEN-123");
    expect(open<{ token: string }>(sealed, secret, "session")).toEqual({ token: "ACCESS-TOKEN-123" });
  });
  it("is refused when tampered with, with another secret, or for another purpose", () => {
    const sealed = seal({ a: 1 }, secret, "session");
    const flipped = sealed.slice(0, -2) + (sealed.endsWith("AA") ? "BB" : "AA");
    expect(open(flipped, secret, "session")).toBeNull();
    expect(open(sealed, "another-secret-another-secret-12", "session")).toBeNull();
    expect(open(sealed, secret, "transaction")).toBeNull();
    expect(open(undefined, secret, "session")).toBeNull();
    expect(open("garbage", secret, "session")).toBeNull();
  });
});
