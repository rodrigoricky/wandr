import { describe, expect, it } from "vitest";
import type { Airport, Place } from "@wandr/shared";
import index from "../data/airport-index.json";
import { airportIndexMetadata, distanceBetween, resolveAirport } from "../src/data/airport-index";
import { compareAir, greatCircleGeometry } from "../src/services/compare-air";

const davao: Place = { id: "davao", label: "Davao City", city: "Davao City", country: "Philippines", countryCode: "PH", coordinates: { lat: 7.064, lon: 125.608 } };
const tokyo: Place = { id: "tokyo", label: "Tokyo Tower", city: "Tokyo", country: "Japan", countryCode: "JP", coordinates: { lat: 35.6586, lon: 139.7454 } };
const eiffel: Place = { id: "eiffel", label: "Eiffel Tower", city: "Paris", country: "France", countryCode: "FR", coordinates: { lat: 48.8584, lon: 2.2945 } };
const cebu: Place = { id: "cebu", label: "Cebu City", city: "Cebu City", country: "Philippines", countryCode: "PH", coordinates: { lat: 10.3157, lon: 123.8854 } };

describe("OurAirports index and air-corridor preview", () => {
  it("uses only scheduled-service large/medium IATA airports with valid country and coordinates", () => {
    expect(index.airports.length).toBeGreaterThan(1_000);
    expect(index.airports.every((airport) => airport.scheduledService && /^[A-Z]{3}$/.test(airport.iata)
      && ["large_airport", "medium_airport"].includes(airport.type) && /^[A-Z]{2}$/.test(airport.countryCode)
      && Math.abs(airport.lat) <= 90 && Math.abs(airport.lon) <= 180)).toBe(true);
  });

  it("records the pinned upstream revision and filtered record count", () => {
    const metadata = airportIndexMetadata();
    expect(metadata.revision).toMatch(/^[a-f0-9]{40}$/);
    expect(metadata.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(metadata.count).toBe(index.airports.length);
  });

  it("resolves Davao and Tokyo to nearby served airports in the correct country", () => {
    expect(resolveAirport(davao)).toMatchObject({ iata: "DVO", countryCode: "PH", municipality: "Davao" });
    const airport = resolveAirport(tokyo);
    expect(["HND", "NRT"]).toContain(airport?.iata);
    expect(airport?.countryCode).toBe("JP");
    expect(distanceBetween(tokyo.coordinates, airport!.coordinates)).toBeLessThan(100_000);
  });

  it("does not select a geographically close airport from the wrong country or far outside catchment", () => {
    expect(resolveAirport({ ...davao, countryCode: "JP" })).toBeNull();
    expect(resolveAirport({ id: "antarctica", label: "Antarctica", countryCode: "AQ", coordinates: { lat: -75, lon: 0 } })).toBeNull();
  });

  it("returns an honest recoverable result when one place has no suitable airport", () => {
    const result = compareAir(davao, { id: "remote", label: "Remote", countryCode: "AQ", coordinates: { lat: -75, lon: 0 } });
    expect(result).toMatchObject({ airports: null, airRoute: null, options: [], warning: expect.stringContaining("could not be resolved") });
  });

  it("uses a generic estimate for unrelated global pairs and airline references only for a Philippines pair", () => {
    expect(compareAir(eiffel, tokyo).options.map((option) => option.providerId)).toEqual(["generic_air"]);
    expect(compareAir(davao, tokyo).options.map((option) => option.providerId)).toEqual(["philippine_airlines", "cebu_pacific"]);
    expect(compareAir(davao, tokyo).options.every((option) => option.fare.status === "estimated" && option.transfers === null)).toBe(true);
  });

  it("builds at least 20 great-circle points and splits antimeridian crossings without world-wrap segments", () => {
    const point = (iata: string, lat: number, lon: number): Airport => ({ iata, name: iata, coordinates: { lat, lon }, countryCode: "US", municipality: null, type: "large_airport", region: null });
    const route = greatCircleGeometry(point("A", 10, 170), point("B", 15, -170));
    expect(route.distanceMeters).toBeGreaterThan(0);
    expect(route.geometry.type).toBe("MultiLineString");
    if (route.geometry.type === "MultiLineString") {
      expect(route.geometry.coordinates.every((line) => line.length >= 2)).toBe(true);
      expect(route.geometry.coordinates.flatMap((line) => line).length).toBeGreaterThanOrEqual(20);
      for (const line of route.geometry.coordinates) for (let i = 1; i < line.length; i += 1) expect(Math.abs(line[i][0] - line[i - 1][0])).toBeLessThanOrEqual(180);
      expect(route.geometry.coordinates[0].at(-1)?.[0]).toBe(180);
      expect(route.geometry.coordinates[1][0][0]).toBe(-180);
    }
  });

  it("keeps the route between DVO and Japan airports as a schematic corridor only", () => {
    const result = compareAir(davao, tokyo);
    expect(result.airRoute?.source).toBe("great_circle_preview");
    expect(result.airRoute?.geometry.type).toBe("LineString");
    if (result.airRoute?.geometry.type === "LineString") expect(result.airRoute.geometry.coordinates.length).toBeGreaterThanOrEqual(20);
    expect(result.airRoute?.note).toContain("not a flight track");
    const fares = result.options.map((option) => option.fare.min);
    expect(fares.every((fare) => fare !== null && fare >= 8_000 && fare <= 20_000)).toBe(true);
  });

  it("resolves a Davao to Cebu domestic corridor using airports in the Philippines", () => {
    const result = compareAir(davao, cebu);
    expect(result.airports).toMatchObject({ origin: { iata: "DVO", countryCode: "PH" }, destination: { iata: "CEB", countryCode: "PH" } });
    expect(result.options.map((option) => option.providerId)).toEqual(["philippine_airlines", "cebu_pacific"]);
    expect(result.airRoute?.source).toBe("great_circle_preview");
  });
});
