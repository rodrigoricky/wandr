import { describe, expect, it } from "vitest";
import { toGeoLine, validCoordinates } from "../src/geo";

describe("coordinate boundaries and order", () => {
  it("accepts valid API latitude/longitude and rejects invalid bounds", () => {
    expect(validCoordinates({ lat: 7.07, lon: 125.61 })).toBe(true);
    expect(validCoordinates({ lat: 91, lon: 125.61 })).toBe(false);
    expect(validCoordinates({ lat: 7, lon: Number.NaN })).toBe(false);
  });
  it("preserves GeoJSON [longitude, latitude] order", () => {
    expect(toGeoLine([[125.61, 7.07], [125.62, 7.08]])?.coordinates[0]).toEqual([125.61, 7.07]);
    expect(toGeoLine([[7.07, 125.61]])).toBeNull();
  });
});
