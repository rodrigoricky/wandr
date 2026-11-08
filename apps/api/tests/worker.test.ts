import { describe, expect, it, vi } from "vitest";
import worker from "../src/index";

describe("public Worker contract", () => {
  it("reports health readiness without exposing secrets or claiming an upstream probe", async () => {
    const response = await worker.fetch(new Request("https://api.test/v1/health"), { GEOAPIFY_API_KEY: "private-token", ALLOWED_ORIGINS: "" });
    const body = await response.json() as Record<string, unknown>;
    expect(body).toMatchObject({ status: "ok", providersProbed: false, configured: { geoapify: true } });
    expect(JSON.stringify(body)).not.toContain("private-token");
  });
  it("returns coordinate-only reverse-geocode fallback when the key is missing", async () => {
    const response = await worker.fetch(new Request("https://api.test/v1/places/reverse?lat=7.07&lon=125.61"), {});
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ label: "7.07000, 125.61000", fallback: true });
  });
  it("returns consistent missing-configuration errors for place search", async () => {
    const response = await worker.fetch(new Request("https://api.test/v1/places/search?q=Davao"), {});
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "CONFIGURATION_MISSING", retryable: false } });
  });
  it("rejects incomplete or invalid place-search bias before any provider request", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const incomplete = await worker.fetch(new Request("https://api.test/v1/places/search?q=Tokyo%20Tower&lat=7.07"), { GEOAPIFY_API_KEY: "private-token" });
    const invalid = await worker.fetch(new Request("https://api.test/v1/places/search?q=Tokyo%20Tower&lat=91&lon=2"), { GEOAPIFY_API_KEY: "private-token" });
    expect(incomplete.status).toBe(400);
    expect(invalid.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("returns a generic international air corridor for global places without calling a route provider", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const trip = {
      origin: { id: "geoapify:eiffel", label: "Eiffel Tower", addressLine: "Paris, France", city: "Paris", country: "France", countryCode: "FR", coordinates: { lat: 48.8584, lon: 2.2945 } },
      destination: { id: "geoapify:tokyo", label: "Tokyo Tower", addressLine: "Tokyo, Japan", city: "Tokyo", country: "Japan", countryCode: "JP", coordinates: { lat: 35.6586, lon: 139.7454 } },
    };
    const response = await worker.fetch(new Request("https://api.test/v1/trips/compare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(trip) }), {});
    expect(response.status).toBe(200);
    const body = await response.json() as { scope: string; journeyType: string; origin: { label: string }; airports: { origin: { iata: string }; destination: { iata: string } } | null; airRoute: { geometry: { coordinates?: unknown[] } } | null; options: { providerId: string }[] };
    expect(body).toMatchObject({ scope: "international", journeyType: "international", origin: { label: "Eiffel Tower" }, airports: { origin: { iata: "ORY" }, destination: { iata: "HND" } }, options: [{ providerId: "generic_air" }] });
    expect(body.airRoute?.geometry.coordinates?.length).toBeGreaterThanOrEqual(20);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("returns Davao to Tokyo as a corridor with reference carriers and never a nonstop claim", async () => {
    const trip = {
      origin: { id: "davao", label: "Davao City", city: "Davao City", country: "Philippines", countryCode: "PH", coordinates: { lat: 7.064, lon: 125.608 } },
      destination: { id: "tokyo", label: "Tokyo Tower", city: "Tokyo", country: "Japan", countryCode: "JP", coordinates: { lat: 35.6586, lon: 139.7454 } },
    };
    const response = await worker.fetch(new Request("https://api.test/v1/trips/compare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(trip) }), {});
    const body = await response.json() as { journeyType: string; airports: { origin: { iata: string }; destination: { iata: string } } | null; options: { providerId: string; availability: string; note: string | null }[]; airRoute: { note: string } | null };
    expect(response.status).toBe(200);
    expect(body.journeyType).toBe("international");
    expect(body.airports).toMatchObject({ origin: { iata: "DVO" }, destination: { iata: "HND" } });
    expect(body.options.map((option) => option.providerId)).toEqual(["philippine_airlines", "cebu_pacific"]);
    expect(body.options.every((option) => option.availability === "estimated_demo")).toBe(true);
    expect(body.airRoute?.note).toContain("not a flight track");
  });
  it("enforces configured rate-limit bindings and allows only configured CORS origins", async () => {
    const limit = vi.fn(async () => ({ success: false }));
    const request = new Request("https://api.test/v1/places/search?q=Davao", { headers: { Origin: "https://wandr.example", "CF-Connecting-IP": "203.0.113.1" } });
    const response = await worker.fetch(request, { ALLOWED_ORIGINS: "https://wandr.example", API_LIMITER: { limit } });
    expect(response.status).toBe(429);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://wandr.example");
    await expect(response.json()).resolves.toMatchObject({ error: { code: "RATE_LIMITED", retryable: true } });
    expect(limit).toHaveBeenCalledWith({ key: "203.0.113.1" });
  });
});
