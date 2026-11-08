import { describe, expect, it } from "vitest";
import { adduJacintoDemoStart, adduJacintoDemoStartSource } from "../src";

describe("Ateneo de Davao Jacinto/Main Campus demo start", () => {
  it("uses the Geoapify-confirmed Jacinto campus point and official campus address", () => {
    expect(adduJacintoDemoStart).toMatchObject({
      id: `geoapify:${adduJacintoDemoStartSource.geoapifyPlaceId}`,
      label: "Ateneo de Davao University — Jacinto/Main Campus",
      countryCode: "PH",
      coordinates: adduJacintoDemoStartSource.coordinates,
      checkedAt: "2026-11-08",
    });
    expect(adduJacintoDemoStartSource.officialSourceUrl).toBe("https://www.addu.edu.ph/contact-us/");
    expect(adduJacintoDemoStartSource.geoapifyReverseLabel).toContain("E. Jacinto Street");
  });
});
