import { beforeEach, describe, expect, it, vi } from "vitest";
import { route } from "../src/providers/geoapify";
import { compare } from "../src/services/compare";

vi.mock("../src/providers/geoapify", () => ({ route: vi.fn() }));

const request = {
  origin: { id: "a", label: "A", country: "Philippines", countryCode: "PH", coordinates: { lat: 7.064, lon: 125.608 } },
  destination: { id: "b", label: "B", country: "Philippines", countryCode: "PH", coordinates: { lat: 7.05, lon: 125.595 } },
};

function leg(mode: "walk" | "drive", distanceMeters: number, durationSeconds: number) {
  return [{ mode, title: mode === "walk" ? "Walking route" : "Driving route estimate", distanceMeters, durationSeconds,
    geometry: { type: "LineString" as const, coordinates: [[125.608, 7.064], [125.595, 7.05]] as [number, number][] },
    steps: [], source: "Geoapify Routing" }];
}

describe("local estimated transportation options", () => {
  beforeEach(() => vi.mocked(route).mockReset());

  it("adds deterministic motorized estimates when a real road route is available", async () => {
    vi.mocked(route).mockImplementation(async (_env, mode) => mode === "walk" ? leg(mode, 1_000, 1_000) : leg(mode, 5_000, 600));
    const result = await compare({}, request);
    const repeated = await compare({}, { origin: { ...request.origin, label: "a" }, destination: { ...request.destination, label: "b" } });
    expect(result.journeyType).toBe("local");
    expect(result.options.map((option) => option.providerId)).toEqual(["walk", "grab_taxi", "green_gsm_taxi", "maxim_motorcycle", "jeepney"]);
    expect(result.options.filter((option) => option.mode !== "walk").every((option) => option.availability === "estimated_demo"
      && option.fare.status === "estimated" && option.estimate?.kind === "demo_model" && option.estimate.version)).toBe(true);
    const taxis = result.options.filter((option) => option.mode === "taxi");
    expect(taxis.map((option) => option.providerId)).toEqual(["grab_taxi", "green_gsm_taxi"]);
    expect(taxis[0].fare.min).not.toBe(taxis[1].fare.min);
    expect(repeated.options.map((option) => [option.mode, option.fare.min, option.fare.max, option.totalDurationSeconds]))
      .toEqual(result.options.map((option) => [option.mode, option.fare.min, option.fare.max, option.totalDurationSeconds]));
    expect(result.options.find((option) => option.id === "drive")).toBeUndefined();
    expect(result.warnings).toEqual([]);
  });

  it("keeps motor estimates when the short-walk threshold is exceeded", async () => {
    vi.mocked(route).mockImplementation(async (_env, mode) => mode === "walk" ? leg(mode, 2_001, 1_000) : leg(mode, 5_000, 600));
    const result = await compare({}, request);
    expect(result.options.some((option) => option.mode === "walk")).toBe(false);
    expect(result.options.filter((option) => option.mode === "taxi")).toHaveLength(2);
    expect(result.options.some((option) => option.mode === "motorcycle")).toBe(true);
  });

  it("excludes walking when either default distance or duration limit is exceeded", async () => {
    vi.mocked(route).mockImplementation(async (_env, mode) => mode === "walk" ? leg(mode, 1_400, 1_501) : leg(mode, 5_000, 600));
    const result = await compare({}, request);
    expect(result.options.some((option) => option.mode === "walk")).toBe(false);
    expect(result.options.length).toBeGreaterThan(0);
  });

});
