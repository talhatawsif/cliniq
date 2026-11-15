import { describe, expect, it, vi } from "vitest";

const item = { id: "i1", status: "pending", condition_id: "gone", alternatives: [] };
const del = vi.fn(() => ({ eq: async () => ({ error: null }) }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => {}) }));
vi.mock("@/lib/fhir/write", () => ({ validateBundle: vi.fn(), writeBundle: vi.fn() }));
vi.mock("@/lib/fhir/client", () => ({ fhirFetch: async () => null })); // the Condition was wiped
vi.mock("@/lib/supabase", () => ({
  admin: () => ({
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: item }) }) }), delete: del }),
  }),
}));

describe("decide", () => {
  it("drops an item whose Condition no longer exists, and says so", async () => {
    const { decide } = await import("./review");
    await expect(decide("i1", "confirm", "u1")).rejects.toThrow(/removed from the queue/);
    expect(del).toHaveBeenCalledOnce();
  });
});
