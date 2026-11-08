import { beforeEach, describe, expect, it, vi } from "vitest";
import { route } from "../src/providers/geoapify";
import { compare } from "../src/services/compare";

vi.mock("../src/providers/geoapify", () => ({ route: vi.fn() }));

const request = {
  origin: { id: "a", label: "A", coordinates: { lat: 7.064, lon: 125.608 } },
  destination: { id: "b", label: "B", coordinates: { lat: 7.05, lon: 125.595 } },
};

function leg(mode: "walk" | "drive", distanceMeters: number, durationSeconds: number) {
  return [{ mode, title: mode === "walk" ? "Walking route" : "Driving route estimate", distanceMeters, durationSeconds,
    geometry: { type: "LineString" as const, coordinates: [[125.608, 7.064], [125.595, 7.05]] as [number, number][] },
    steps: [], source: "Geoapify Routing" }];
}

describe("comparison ranking semantics", () => {
  beforeEach(() => vi.mocked(route).mockReset());

  it("never ranks a road driving baseline as a fastest passenger journey", async () => {
    vi.mocked(route).mockImplementation(async (_env, mode) => mode === "walk" ? leg(mode, 1_000, 1_000) : leg(mode, 1_000, 400));
    const result = await compare({}, request);
    expect(result.options.find((option) => option.mode === "drive")?.rankingEligible.fastest).toBe(false);
    expect(result.options.find((option) => option.mode === "walk")?.rankingEligible).toEqual({ cheapest: true, fastest: true });
  });

  it("does not put a long or slow walk into the default money-saving options", async () => {
    vi.mocked(route).mockImplementation(async (_env, mode) => mode === "walk" ? leg(mode, 1_501, 1_000) : leg(mode, 2_000, 600));
    const result = await compare({}, request);
    expect(result.options.some((option) => option.mode === "walk")).toBe(false);
    expect(result.warnings.some((warning) => warning.includes("short-walk comparison limit"))).toBe(true);
  });

  it("keeps a short walk and excludes walking that exceeds the time limit", async () => {
    vi.mocked(route).mockImplementation(async (_env, mode) => mode === "walk" ? leg(mode, 1_400, 1_501) : leg(mode, 2_000, 600));
    const result = await compare({}, request);
    expect(result.options.some((option) => option.mode === "walk")).toBe(false);
  });
});
