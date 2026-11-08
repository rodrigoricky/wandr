import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.resetModules();
});

describe("in-memory place search cache", () => {
  it("reuses a normalized query for its exact location bias and expires it after one minute", async () => {
    vi.useFakeTimers({ now: new Date("2026-11-08T00:00:00Z") });
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example.test");
    const places = [{ id: "geoapify:one", label: "Place One", addressLine: "Davao City", category: null, source: "Geoapify", confidence: null, coordinates: { lat: 7.07, lon: 125.61 } }];
    const fetchMock = vi.fn(async () => Response.json({ places }));
    vi.stubGlobal("fetch", fetchMock);
    const { findPlaces, getCachedPlaceSearch } = await import("../lib/api-client");
    const bias = { lat: 7.07, lon: 125.61 };

    await expect(findPlaces(" SM City Davao ", undefined, bias)).resolves.toEqual(places);
    expect(getCachedPlaceSearch("sm city davao", bias)).toEqual(places);
    await findPlaces("sm CITY davao", undefined, bias);
    await findPlaces("sm city davao", undefined, { lat: 7.071, lon: 125.61 });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(60_001);
    expect(getCachedPlaceSearch("sm city davao", bias)).toBeUndefined();
  });
});
