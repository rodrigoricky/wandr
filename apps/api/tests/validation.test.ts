import { describe, expect, it } from "vitest";
import { readCompareRequest, validatePlace } from "../src/lib/validation";
import { ApiFailure } from "../src/lib/errors";

const place = (id: string, lat: number, lon: number) => ({ id, label: `${id}, Davao City`, coordinates: { lat, lon } });

describe("API input validation", () => {
  it("accepts a distinct selected Davao trip", async () => {
    const request = new Request("https://api.test/v1/trips/compare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ origin: place("a", 7.07, 125.61), destination: place("b", 7.1, 125.62) }) });
    await expect(readCompareRequest(request)).resolves.toMatchObject({ origin: { id: "a" }, destination: { id: "b" } });
  });
  it("accepts the 205-character Geoapify place ID for the reviewed AdDU Jacinto demo pin", async () => {
    const originId = "geoapify:51bfefdfbc38675f4059ffe89b340d4a1c40f00102f9013d69ba0100000000c0020192031a4174656e656f20646520446176616f20556e6976657273697479e203206f70656e7374726565746d61703a76656e75653a7761792f3238393933383533";
    const request = new Request("https://api.test/v1/trips/compare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ origin: { ...place(originId, 7.072316, 125.612838), label: "Ateneo de Davao University — Jacinto/Main Campus" }, destination: place("city-hall", 7.064662, 125.6079614) }) });
    await expect(readCompareRequest(request)).resolves.toMatchObject({ origin: { id: originId, coordinates: { lat: 7.072316, lon: 125.612838 } } });
  });
  it("rejects the same place but accepts globally resolved labels and coordinates", async () => {
    const request = new Request("https://api.test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ origin: place("a", 7.07, 125.61), destination: place("a", 7.07, 125.61) }) });
    await expect(readCompareRequest(request)).rejects.toMatchObject({ code: "SAME_PLACE" });
    expect(validatePlace({ id: "geoapify:eiffel", label: "Eiffel Tower", addressLine: "Paris, France", coordinates: { lat: 48.8584, lon: 2.2945 } }, "Origin"))
      .toMatchObject({ label: "Eiffel Tower", coordinates: { lat: 48.8584, lon: 2.2945 } });
    expect(() => validatePlace(place("x", 91, 121), "Origin")).toThrow(ApiFailure);
  });
});
