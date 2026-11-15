import { describe, expect, it } from "vitest";
import { access } from "./access";

const demo = "demo@example.com";
describe("access", () => {
  it("lets the demo account in with a password alone", () => {
    expect(access({ email: demo, aal: "aal1" }, demo)).toBe("allow");
  });
  it("makes staff pass the authenticator code first", () => {
    const staff = { email: "s@example.com", app_metadata: { role: "staff" } };
    expect(access({ ...staff, aal: "aal1" }, demo)).toBe("mfa");
    expect(access({ ...staff, aal: "aal2" }, demo)).toBe("allow");
  });
  it("refuses anyone else, even with a code (an open sign-up)", () => {
    expect(access({ email: "x@example.com", aal: "aal2" }, demo)).toBe("deny");
    expect(access({ email: "x@example.com", aal: "aal2", app_metadata: { role: "user" } }, demo)).toBe("deny");
  });
  it("does not treat everyone as the demo user when no demo account is set", () => {
    expect(access({ aal: "aal1" }, undefined)).toBe("deny");
  });
});
