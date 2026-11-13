import { randomUUID } from "node:crypto";
import { loadEnvFile } from "node:process";
import { describe, expect, it } from "vitest";

try {
  loadEnvFile(".env.local");
} catch {
  // CI without a file: the live tests below skip.
}
const live = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);

describe.skipIf(!live)("quotas and audit tables (live Supabase)", () => {
  it("the 3rd call with a limit of 2 is refused, and a guarded request returns 429", async () => {
    const { consumeQuota, guardRequest } = await import("@/lib/quota");
    const name = `test-${randomUUID()}`;
    expect([await consumeQuota(name, 2), await consumeQuota(name, 2), await consumeQuota(name, 2)]).toEqual([
      true,
      true,
      false,
    ]);
    const res = await guardRequest(new Request("http://x", { method: "POST", body: "hi" }), "hl7", 0);
    expect((res as Response).status).toBe(429);
    const { admin } = await import("@/lib/supabase");
    await admin().from("quotas").delete().eq("name", name);
  });

  it("a body over 50 kB is refused with 413", async () => {
    const { guardRequest } = await import("@/lib/quota");
    const res = await guardRequest(
      new Request("http://x", { method: "POST", body: "x".repeat(50_001) }),
      "hl7",
      5,
    );
    expect((res as Response).status).toBe(413);
  });

  it("the anon key cannot read audit_events or quotas, or call consume_quota", async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    const h = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
    for (const table of ["audit_events", "quotas"]) {
      const r = await fetch(`${url}/rest/v1/${table}?select=*`, { headers: h });
      expect(await r.json()).toEqual([]); // RLS: no policy, no rows
    }
    const rpc = await fetch(`${url}/rest/v1/rpc/consume_quota`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ p_name: "x", p_limit: 1 }),
    });
    expect(rpc.status).toBeGreaterThanOrEqual(400);
  });
});
