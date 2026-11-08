import { describe, expect, it } from "vitest";
import { combineRouteGeometries, toGeoGeometry, toGeoLine, validCoordinates } from "../src/geo";

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
  it("validates multipart geometry and preserves every ordered segment when combining route legs", () => {
    const first = toGeoGeometry({ type: "LineString", coordinates: [[125.61, 7.07], [125.615, 7.075]] });
    const second = toGeoGeometry({ type: "MultiLineString", coordinates: [[[125.615, 7.075], [125.62, 7.08]], [[125.62, 7.08], [125.625, 7.085]]] });
    expect(combineRouteGeometries([first, second])).toEqual({ type: "MultiLineString", coordinates: [
      [[125.61, 7.07], [125.615, 7.075]],
      [[125.615, 7.075], [125.62, 7.08]],
      [[125.62, 7.08], [125.625, 7.085]],
    ] });
    expect(toGeoGeometry({ type: "MultiLineString", coordinates: [[[125.61, 7.07]]] })).toBeNull();
  });
});
