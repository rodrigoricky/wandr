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
  it("keeps global place selections and returns unsupported coverage without calling routing", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const trip = {
      origin: { id: "geoapify:eiffel", label: "Eiffel Tower", addressLine: "Paris, France", coordinates: { lat: 48.8584, lon: 2.2945 } },
      destination: { id: "geoapify:tokyo", label: "Tokyo Tower", addressLine: "Tokyo, Japan", coordinates: { lat: 35.6586, lon: 139.7454 } },
    };
    const response = await worker.fetch(new Request("https://api.test/v1/trips/compare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(trip) }), {});
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ scope: "unsupported", origin: { label: "Eiffel Tower" }, options: [], warnings: [expect.stringContaining("Place found")] });
    expect(fetchMock).not.toHaveBeenCalled();
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
