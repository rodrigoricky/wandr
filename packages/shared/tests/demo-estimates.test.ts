import { describe, expect, it } from "vitest";
import {
  classifyJourney,
  estimateAirDuration,
  estimateBand,
  estimateJeepneyFare,
  estimateRoadDuration,
  estimateRoadFare,
  isOptionRankable,
  providerMetadata,
  providerNames,
  sortTransportOptions,
} from "../src";
import type { TransportOption } from "../src";

const inDavao = (point: { lat: number; lon: number }) => point.lat > 6.8 && point.lat < 7.6 && point.lon > 125.1 && point.lon < 125.9;

function option(id: string, fare: number | null, seconds: number | null, eligible: boolean): TransportOption {
  return {
    id, title: id, mode: "taxi", providerId: "grab_taxi", legs: [],
    fare: { currency: "PHP", min: fare, max: fare, status: fare === null ? "unknown" : "estimated", sourceName: null, sourceUrl: null, checkedAt: null },
    totalDurationSeconds: seconds, totalWalkingMeters: 0, transfers: null, availability: "estimated_demo",
    note: null, rankingEligible: { cheapest: eligible, fastest: eligible },
  };
}

describe("deterministic demo estimates", () => {
  it("rounds money to broad ten-peso estimate bands and is deterministic", () => {
    expect(estimateBand(100)).toEqual({ min: 80, max: 120, midpoint: 100 });
    expect(estimateBand(100)).toEqual(estimateBand(100));
  });

  it("calculates traditional PUJ fare boundaries with whole-kilometre rounding", () => {
    expect(estimateJeepneyFare(0)).toBe(14);
    expect(estimateJeepneyFare(1_000)).toBe(14);
    expect(estimateJeepneyFare(4_000)).toBe(14);
    expect(estimateJeepneyFare(4_001)).toBe(16);
    expect(estimateJeepneyFare(4_100)).toBe(16);
    expect(estimateJeepneyFare(5_000)).toBe(16);
    expect(estimateJeepneyFare(5_001)).toBe(18);
    expect(estimateJeepneyFare(10_000)).toBe(26);
    expect(estimateJeepneyFare(Number.POSITIVE_INFINITY)).toBe(14);
    expect(estimateJeepneyFare(Number.NaN)).toBe(14);
  });

  it("keeps modern PUJ rate distinct and rejects non-finite math by clamping", () => {
    expect(estimateJeepneyFare(4_001, true)).toBe(19.4);
    expect(estimateJeepneyFare(-1)).toBe(14);
  });

  it("uses distinct, deterministic taxi and motorcycle demo models", () => {
    const grab = estimateRoadFare("grab_taxi", 5_000, 600);
    const green = estimateRoadFare("green_gsm_taxi", 5_000, 600);
    const maxim = estimateRoadFare("maxim_motorcycle", 5_000, 600);
    expect(grab.min).toBeGreaterThan(maxim.min);
    expect(green.min).toBeGreaterThan(maxim.min);
    expect(`${grab.min}-${grab.max}`).not.toBe(`${green.min}-${green.max}`);
    expect(`${maxim.min}-${maxim.max}`).toBe(`${estimateRoadFare("maxim_motorcycle", 5_000, 600).min}-${estimateRoadFare("maxim_motorcycle", 5_000, 600).max}`);
    for (const result of [estimateRoadFare("grab_taxi", Number.NaN, Number.POSITIVE_INFINITY), estimateRoadFare("maxim_motorcycle", -1, -1)]) {
      expect(Number.isFinite(result.min) && Number.isFinite(result.max) && result.min >= 0 && result.max >= result.min).toBe(true);
    }
  });

  it("rounds modeled times into five-minute bands and air estimates use a bounded planning allowance", () => {
    expect(estimateRoadDuration("grab_taxi", 0) % 300).toBe(0);
    expect(estimateAirDuration(0)).toBe(7_200);
    expect(estimateAirDuration(1_000_000)).toBeGreaterThan(7_200);
  });

  it("classifies Davao local, same-country, cross-country, and missing-country journeys", () => {
    expect(classifyJourney({ countryCode: "PH", coordinates: { lat: 7.07, lon: 125.61 } }, { countryCode: "PH", coordinates: { lat: 7.08, lon: 125.62 } }, inDavao)).toBe("local");
    expect(classifyJourney({ country: "Philippines", coordinates: { lat: 10, lon: 123 } }, { country: "Philippines", coordinates: { lat: 7, lon: 125 } }, inDavao)).toBe("domestic_long_distance");
    expect(classifyJourney({ countryCode: "FR", coordinates: { lat: 48.8, lon: 2.3 } }, { countryCode: "JP", coordinates: { lat: 35.6, lon: 139.7 } }, inDavao)).toBe("international");
    expect(classifyJourney({ countryCode: "FR", coordinates: { lat: 7.07, lon: 125.61 } }, { countryCode: "JP", coordinates: { lat: 7.08, lon: 125.62 } }, inDavao)).toBe("international");
    expect(classifyJourney({ country: "Philippines", coordinates: { lat: 7.07, lon: 125.61 } }, { countryCode: "PH", coordinates: { lat: 7.08, lon: 125.62 } }, inDavao)).toBe("local");
    expect(classifyJourney({ coordinates: { lat: 48.8, lon: 2.3 } }, { coordinates: { lat: 35.6, lon: 139.7 } }, inDavao)).toBe("unsupported");
  });

  it("classifies any shared Philippine country code as one country, independent of label spelling", () => {
    expect(classifyJourney({ countryCode: "PH", country: "Republic of the Philippines", coordinates: { lat: 8, lon: 125 } }, { countryCode: "PH", country: "Philippines", coordinates: { lat: 10, lon: 123 } }, inDavao)).toBe("domestic_long_distance");
  });

  it("sorts by computed values with stable ties and puts ineligible options last", () => {
    const options = [option("b", 90, 600, true), option("a", 90, 500, true), option("walk", 0, 800, true), option("road", null, 100, false)];
    expect(sortTransportOptions(options, "cheapest").map((item) => item.id)).toEqual(["walk", "a", "b", "road"]);
    expect(sortTransportOptions(options, "fastest").map((item) => item.id)).toEqual(["a", "b", "walk", "road"]);
    const unknown = option("unknown", null, 400, true);
    expect(sortTransportOptions([unknown], "cheapest")[0].id).toBe("unknown");
    expect(isOptionRankable(unknown, "cheapest")).toBe(false);
  });

  it("has concise text identities for every supported provider", () => {
    expect(Object.keys(providerNames).sort()).toEqual(["cebu_pacific", "generic_air", "grab_taxi", "green_gsm_taxi", "jeepney", "maxim_motorcycle", "philippine_airlines", "walk"].sort());
    expect(providerNames.grab_taxi).toBe("Grab Taxi");
    expect(providerNames.green_gsm_taxi).toBe("Green GSM Taxi");
    expect(providerNames.maxim_motorcycle).toBe("Maxim Motorcycle");
    expect(providerNames.philippine_airlines).toBe("Philippine Airlines");
    expect(providerNames.cebu_pacific).toBe("Cebu Pacific");
    expect(providerMetadata.grab_taxi).toMatchObject({ transportationClass: "taxi", localSvgPath: "/brands/grab.svg", accent: "#EAF6ED" });
    expect(providerMetadata.green_gsm_taxi).toMatchObject({ transportationClass: "taxi", localSvgPath: "/brands/green-gsm.svg", accent: "#E7F5F2" });
    expect(providerMetadata.maxim_motorcycle).toMatchObject({ transportationClass: "motorcycle", localSvgPath: "/brands/maxim.svg", accent: "#FFF0F0" });
    expect(providerMetadata.philippine_airlines.localSvgPath).toBe("/brands/philippine-airlines.svg");
    expect(providerMetadata.cebu_pacific.localSvgPath).toBe("/brands/cebu-pacific.svg");
  });
});
