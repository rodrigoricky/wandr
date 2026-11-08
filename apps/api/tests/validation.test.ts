import { describe, expect, it } from "vitest";
import { readCompareRequest, validatePlace } from "../src/lib/validation";
import { ApiFailure } from "../src/lib/errors";

const place = (id: string, lat: number, lon: number) => ({ id, label: `${id}, Davao City`, coordinates: { lat, lon } });

describe("API input validation", () => {
  it("accepts a distinct selected Davao trip", async () => {
    const request = new Request("https://api.test/v1/trips/compare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ origin: place("a", 7.07, 125.61), destination: place("b", 7.1, 125.62) }) });
    await expect(readCompareRequest(request)).resolves.toMatchObject({ origin: { id: "a" }, destination: { id: "b" } });
  });
  it("rejects the same place but accepts globally resolved labels and coordinates", async () => {
    const request = new Request("https://api.test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ origin: place("a", 7.07, 125.61), destination: place("a", 7.07, 125.61) }) });
    await expect(readCompareRequest(request)).rejects.toMatchObject({ code: "SAME_PLACE" });
    expect(validatePlace({ id: "geoapify:eiffel", label: "Eiffel Tower", addressLine: "Paris, France", coordinates: { lat: 48.8584, lon: 2.2945 } }, "Origin"))
      .toMatchObject({ label: "Eiffel Tower", coordinates: { lat: 48.8584, lon: 2.2945 } });
    expect(() => validatePlace(place("x", 91, 121), "Origin")).toThrow(ApiFailure);
  });
});
