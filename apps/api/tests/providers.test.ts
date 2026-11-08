import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeRouteFeature, route, searchPlaces } from "../src/providers/geoapify";
import fixture from "./fixtures/geoapify-routing-multileg.json";
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
      expect(url.searchParams.get("units")).toBe("metric");
      expect(url.searchParams.get("details")).toBe("instruction_details");
      return Response.json({ features: [{ geometry: { type: "LineString", coordinates: [[125.61, 7.07], [125.62, 7.08]] }, properties: { distance: 1400, distance_units: "Meters", time: 900, legs: [{ distance: 1400, time: 900, steps: [{ distance: 1400, time: 900, instruction: { text: "Continue on the mapped path" } }] }] } }] });
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await route({ GEOAPIFY_API_KEY: "test-only" }, "walk", { lat: 7.07, lon: 125.61 }, { lat: 7.08, lon: 125.62 });
    expect(result).toHaveLength(1);
    expect(result[0].geometry).toMatchObject({ type: "LineString", coordinates: [[125.61, 7.07], [125.62, 7.08]] });
    expect(result[0].steps).toEqual([{ instruction: "Continue on the mapped path", distanceMeters: 1400, durationSeconds: 900 }]);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it("normalizes the documented MultiLineString geometry into ordered legs and real steps", () => {
    const legs = normalizeRouteFeature(fixture.features[0], "walk");
    expect(legs).toHaveLength(2);
    expect(legs.map((leg) => [leg.distanceMeters, leg.durationSeconds])).toEqual([[1500, 640], [1600, 680]]);
    expect(legs[0].geometry).toMatchObject({ type: "LineString", coordinates: [[125.61, 7.07], [125.612, 7.072], [125.615, 7.075]] });
    expect(legs[1].geometry).toMatchObject({ type: "LineString", coordinates: [[125.615, 7.075], [125.618, 7.078], [125.62, 7.08]] });
    expect(legs.flatMap((leg) => leg.steps.map((step) => step.instruction))).toEqual([
      "Head northeast on the mapped road", "Turn right at the junction", "Continue along the mapped road", "Arrive at the destination",
    ]);
  });
  it("converts documented miles to meters and rejects malformed geometry and measurements", () => {
    const valid = { geometry: { type: "LineString", coordinates: [[-77.04, 38.89], [-77.03, 38.90]] }, properties: { distance: 1, distance_units: "Miles", time: 30 } };
    expect(normalizeRouteFeature(valid, "drive")[0].distanceMeters).toBeCloseTo(1609.344);
    expect(normalizeRouteFeature({ ...valid, geometry: { type: "MultiLineString", coordinates: [[[181, 38], [-77, 39]]] } }, "drive")).toEqual([]);
    expect(normalizeRouteFeature({ ...valid, properties: { distance: -1, time: 0 } }, "drive")).toEqual([]);
  });
  it("maps provider rate limits to a retryable upstream error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 429 })));
    await expect(route({ GEOAPIFY_API_KEY: "test-only" }, "drive", { lat: 7.07, lon: 125.61 }, { lat: 7.08, lon: 125.62 }))
      .rejects.toMatchObject({ code: "UPSTREAM_QUOTA", retryable: true });
  });
  it("maps network timeout and explicit request cancellation without fake geometry", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network failure"); }));
    await expect(route({ GEOAPIFY_API_KEY: "test-only" }, "walk", { lat: 7.07, lon: 125.61 }, { lat: 7.08, lon: 125.62 }))
      .rejects.toMatchObject({ code: "UPSTREAM_TIMEOUT", retryable: true });
    const controller = new AbortController(); controller.abort();
    await expect(route({ GEOAPIFY_API_KEY: "test-only" }, "walk", { lat: 7.07, lon: 125.61 }, { lat: 7.08, lon: 125.62 }, controller.signal))
      .rejects.toMatchObject({ code: "REQUEST_ABORTED" });
  });
});

describe("Geoapify worldwide place autocomplete", () => {
  it("uses a non-restrictive proximity bias and returns named, disambiguated POIs first", async () => {
    const requestUrl: URL[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: URL | RequestInfo) => {
      const url = new URL(String(input)); requestUrl.push(url);
      return Response.json({ features: [
        { geometry: { coordinates: [2.2945, 48.8584] }, properties: { place_id: "tower-1", name: "Eiffel Tower", formatted: "Eiffel Tower, Champ de Mars, 75007 Paris, France", address_line2: "Champ de Mars, 75007 Paris", city: "Paris", country: "France", country_code: "fr", category: "tourism.attraction", result_type: "amenity", rank: { confidence: 0.99 } } },
        { geometry: { coordinates: [2.2945, 48.8584] }, properties: { place_id: "duplicate-provider-id", name: "Eiffel Tower", formatted: "Eiffel Tower, Champ de Mars, 75007 Paris, France", city: "Paris", country: "France" } },
        { geometry: { coordinates: [2.29, 48.85] }, properties: { place_id: "other", name: "Eiffel Tower Garage", formatted: "Eiffel Tower Garage, Paris", category: "parking" } },
        { geometry: { coordinates: [181, 48.85] }, properties: { place_id: "bad", name: "Invalid coordinate" } },
      ] });
    }));
    const places = await searchPlaces({ GEOAPIFY_API_KEY: "test-only" }, "Eiffel Tower", { lat: 7.073, lon: 125.612 });
    expect(requestUrl[0].searchParams.has("filter")).toBe(false);
    expect(requestUrl[0].searchParams.get("bias")).toBe("proximity:125.612,7.073");
    expect(places).toHaveLength(2);
    expect(places[0]).toMatchObject({ id: "geoapify:tower-1", label: "Eiffel Tower", addressLine: "Champ de Mars, 75007 Paris, France", category: "tourism.attraction", city: "Paris", country: "France", countryCode: "FR", source: "Geoapify", confidence: 0.99, coordinates: { lon: 2.2945, lat: 48.8584 } });
  });
  it("uses a default Davao ranking bias without restricting global matches", async () => {
    const fetchMock = vi.fn(async (_input: URL | RequestInfo) => Response.json({ features: [] }));
    vi.stubGlobal("fetch", fetchMock);
    await searchPlaces({ GEOAPIFY_API_KEY: "test-only" }, "Tokyo Tower");
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get("bias")).toBe("proximity:125.612,7.073");
    expect(url.searchParams.has("filter")).toBe(false);
  });
});

describe("trip comparison honesty", () => {
  it("keeps live route geometry distinct from deterministic estimated option prices", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: URL | RequestInfo) => {
      const url = new URL(String(input));
      const mode = url.searchParams.get("mode");
      return Response.json({ features: [{ geometry: { type: "LineString", coordinates: [[125.61, 7.07], [125.62, 7.08]] }, properties: { distance: 1400, time: mode === "walk" ? 900 : 240 } }] });
    }));
    const result = await compare({ GEOAPIFY_API_KEY: "test-only" }, {
      origin: { id: "a", label: "A, Davao City", coordinates: { lat: 7.07, lon: 125.61 } },
      destination: { id: "b", label: "B, Davao City", coordinates: { lat: 7.08, lon: 125.62 } },
    });
    expect(result.options.map((item) => item.providerId)).toEqual(["walk", "grab_taxi", "green_gsm_taxi", "maxim_motorcycle", "jeepney"]);
    expect(result.options[0].fare.min).toBe(0);
    expect(result.options[1].fare.status).toBe("estimated");
    expect(result.options[1].availability).toBe("estimated_demo");
    expect(result.options[1].legs[0].geometry?.type).toBe("LineString");
    expect(result.warnings).toEqual([]);
  });
  it("does not replace missing routes with demo data", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ features: [] }), { status: 200 })));
    await expect(compare({ GEOAPIFY_API_KEY: "test-only" }, {
      origin: { id: "a", label: "A, Davao City", coordinates: { lat: 7.07, lon: 125.61 } },
      destination: { id: "b", label: "B, Davao City", coordinates: { lat: 7.08, lon: 125.62 } },
    })).rejects.toMatchObject({ code: "NO_SUPPORTED_ROUTE" });
  });
  it("keeps a valid walk and reports one concise issue if road routing fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: URL | RequestInfo) => {
      const url = new URL(String(input));
      if (url.searchParams.get("mode") === "drive") return new Response("", { status: 503 });
      return Response.json({ features: [{ geometry: { type: "LineString", coordinates: [[125.61, 7.07], [125.62, 7.08]] }, properties: { distance: 1000, time: 900 } }] });
    }));
    const result = await compare({ GEOAPIFY_API_KEY: "test-only" }, {
      origin: { id: "a", label: "A", coordinates: { lat: 7.07, lon: 125.61 } },
      destination: { id: "b", label: "B", coordinates: { lat: 7.08, lon: 125.62 } },
    });
    expect(result.options.map((option) => option.mode)).toEqual(["walk"]);
    expect(result.warnings).toEqual(["Motorized estimates are unavailable because the road route could not be loaded."]);
  });
  it("keeps provider configuration errors instead of estimating without a road basis", async () => {
    await expect(compare({}, {
      origin: { id: "a", label: "A", coordinates: { lat: 7.07, lon: 125.61 } },
      destination: { id: "b", label: "B", coordinates: { lat: 7.08, lon: 125.62 } },
    })).rejects.toMatchObject({ code: "CONFIGURATION_MISSING" });
  });
});

it("models provider failures without exposing credential values", () => {
  const failure = new ApiFailure(503, "CONFIGURATION_MISSING", "Configure the service key.");
  expect(failure.message).not.toContain("secret-value");
});
