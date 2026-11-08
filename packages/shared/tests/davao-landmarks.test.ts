import { describe, expect, it } from "vitest";
import { davaoLandmarkIndexMetadata, findDavaoLandmarks } from "../src/davao-landmarks";

describe("reviewed Davao landmark lookup", () => {
  it("returns verified coordinates and provenance for recognizable local aliases", () => {
    expect(findDavaoLandmarks("Abreeza Mall")[0]).toMatchObject({
      id: "davao-index:abreeza-ayala-mall",
      coordinates: { lon: 125.611561, lat: 7.0912032 },
      countryCode: "PH",
      sourceRecord: "Geoapify Geocoding API result",
      sourceUrl: "https://apidocs.geoapify.com/docs/geocoding/",
      sourceQuery: "Abreeza Mall Davao",
      checkedAt: "2026-11-08",
    });
    expect(findDavaoLandmarks("UM Matina")[0].label).toBe("University of Mindanao - Matina Campus");
    expect(findDavaoLandmarks("Davao Airport")[0].label).toBe("Francisco Bangoy International Airport");
    expect(findDavaoLandmarks("DDH Davao")[0].label).toBe("Davao Doctors Hospital");
    expect(davaoLandmarkIndexMetadata.count).toBe(7);
  });

  it("does not hijack generic city hall or worldwide landmark searches", () => {
    expect(findDavaoLandmarks("City Hall")).toEqual([]);
    expect(findDavaoLandmarks("Eiffel Tower")).toEqual([]);
    expect(findDavaoLandmarks("x")).toEqual([]);
  });
});
