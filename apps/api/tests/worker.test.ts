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
