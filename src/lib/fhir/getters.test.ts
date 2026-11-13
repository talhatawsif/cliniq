import { describe, expect, it, vi } from "vitest";

const search = vi.fn(async () => []);
vi.mock("./client", async (orig) => ({
  ...(await orig<typeof import("./client")>()),
  fhirSearch: search,
  fhirFetch: vi.fn(async () => null),
}));

describe("patient ids from the URL", () => {
  it("an id that could add search parameters never reaches the FHIR server", async () => {
    const { getConditions, getAllergies, getObservations, getChartData, getPatient } =
      await import("./index");
    const bad = "x&_include=*";
    expect(await getConditions(bad)).toEqual([]);
    expect(await getAllergies(bad)).toEqual([]);
    expect(await getObservations(bad, "laboratory")).toEqual([]);
    expect((await getChartData(bad)).medications).toEqual([]);
    expect(await getPatient(bad)).toBeNull();
    expect(search).not.toHaveBeenCalled();
    await getConditions("abc-123");
    expect(search).toHaveBeenCalledTimes(1);
  });
});
