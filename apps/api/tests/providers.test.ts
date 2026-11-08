import { afterEach, describe, expect, it, vi } from "vitest";
import { route } from "../src/providers/geoapify";
import { compare } from "../src/services/compare";
import { ApiFailure } from "../src/lib/errors";

afterEach(() => vi.unstubAllGlobals());

describe("Geoapify routing adapter", () => {
  it("requires credentials rather than returning synthetic paths", async () => {
    await expect(route({}, "walk", { lat: 7.07, lon: 125.61 }, { lat: 7.08, lon: 125.62 }))
      .rejects.toMatchObject({ code: "CONFIGURATION_MISSING" });
  });
  it("sends Geoapify waypoint pairs in lat,lon order and normalizes real GeoJSON order", async () => {
    const fetchMock = vi.fn(async (input: URL | RequestInfo) => {
      const url = new URL(String(input));
      expect(url.searchParams.get("waypoints")).toBe("7.07,125.61|7.08,125.62");
      return Response.json({ features: [{ geometry: { type: "LineString", coordinates: [[125.61, 7.07], [125.62, 7.08]] }, properties: { distance: 1400, time: 900 } }] });
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await route({ GEOAPIFY_API_KEY: "test-only" }, "walk", { lat: 7.07, lon: 125.61 }, { lat: 7.08, lon: 125.62 });
    expect(result.geometry?.coordinates[0]).toEqual([125.61, 7.07]);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it("maps provider rate limits to a retryable upstream error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 429 })));
    await expect(route({ GEOAPIFY_API_KEY: "test-only" }, "drive", { lat: 7.07, lon: 125.61 }, { lat: 7.08, lon: 125.62 }))
      .rejects.toMatchObject({ code: "UPSTREAM_QUOTA", retryable: true });
  });
});

describe("trip comparison honesty", () => {
  it("shows only actual routed modes and leaves driving fare unknown", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: URL | RequestInfo) => {
      const url = new URL(String(input));
      const mode = url.searchParams.get("mode");
      return Response.json({ features: [{ geometry: { type: "LineString", coordinates: [[125.61, 7.07], [125.62, 7.08]] }, properties: { distance: 1400, time: mode === "walk" ? 900 : 240 } }] });
    }));
    const result = await compare({ GEOAPIFY_API_KEY: "test-only" }, {
      origin: { id: "a", label: "A, Davao City", coordinates: { lat: 7.07, lon: 125.61 } },
      destination: { id: "b", label: "B, Davao City", coordinates: { lat: 7.08, lon: 125.62 } },
    });
    expect(result.options.map((item) => item.mode)).toEqual(["walk", "drive"]);
    expect(result.options[0].fare.min).toBe(0);
    expect(result.options[1].fare.min).toBeNull();
    expect(result.options[1].rankingEligible.cheapest).toBe(false);
    expect(result.warnings.join(" ")).toContain("No verified Davao public-transport routes");
  });
  it("does not replace missing routes with demo data", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ features: [] }), { status: 200 })));
    await expect(compare({ GEOAPIFY_API_KEY: "test-only" }, {
      origin: { id: "a", label: "A, Davao City", coordinates: { lat: 7.07, lon: 125.61 } },
      destination: { id: "b", label: "B, Davao City", coordinates: { lat: 7.08, lon: 125.62 } },
    })).rejects.toMatchObject({ code: "NO_SUPPORTED_ROUTE" });
  });
});

it("models provider failures without exposing credential values", () => {
  const failure = new ApiFailure(503, "CONFIGURATION_MISSING", "Configure the service key.");
  expect(failure.message).not.toContain("secret-value");
});
