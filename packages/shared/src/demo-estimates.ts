import type { JourneyType, ProviderId, ProviderMetadata, TransportOption } from "./contracts";

export const DEMO_ESTIMATE_VERSION = "wandr-demo-estimates-1.0.0";

export type DemoFare = { min: number; max: number; midpoint: number };

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/** Round estimated money to ten-peso bands to avoid implying quote precision. */
export function estimateBand(amount: number, spread = 0.12): DemoFare {
  const safeAmount = finiteNonNegative(amount);
  const safeSpread = Number.isFinite(spread) ? Math.max(0, Math.min(0.5, spread)) : 0;
  const min = Math.max(0, Math.floor((safeAmount * (1 - safeSpread)) / 10) * 10);
  const max = Math.max(min, Math.ceil((safeAmount * (1 + safeSpread)) / 10) * 10);
  return { min, max, midpoint: Math.round(safeAmount / 10) * 10 };
}

/** Distance is rounded up to whole-kilometre fare bands; it is not a jeepney route distance. */
export function estimateJeepneyFare(roadDistanceMeters: number, modern = false): number {
  const km = finiteNonNegative(roadDistanceMeters) / 1_000;
  const chargedKm = Math.max(0, Math.ceil(km - 1e-9));
  const baseKm = 4;
  const base = modern ? 17 : 14;
  const perKm = modern ? 2.4 : 2;
  return Math.round((base + Math.max(0, chargedKm - baseKm) * perKm) * 100) / 100;
}

export type RoadEstimateMode = "grab_taxi" | "green_gsm_taxi" | "maxim_motorcycle";

const roadModels: Record<RoadEstimateMode, { flagDown: number; perKm: number; perMinute: number; spread: number }> = {
  grab_taxi: { flagDown: 70, perKm: 15, perMinute: 2.5, spread: 0.12 },
  green_gsm_taxi: { flagDown: 65, perKm: 13.5, perMinute: 2, spread: 0.12 },
  maxim_motorcycle: { flagDown: 30, perKm: 9, perMinute: 0.6, spread: 0.16 },
};

export function estimateRoadFare(mode: RoadEstimateMode, roadDistanceMeters: number, roadSeconds: number): DemoFare {
  const model = roadModels[mode];
  const amount = model.flagDown + finiteNonNegative(roadDistanceMeters) / 1_000 * model.perKm + finiteNonNegative(roadSeconds) / 60 * model.perMinute;
  return estimateBand(amount, model.spread);
}

export function estimateRoadDuration(mode: RoadEstimateMode, roadSeconds: number): number {
  const factors: Record<RoadEstimateMode, { factor: number; allowanceSeconds: number }> = {
    grab_taxi: { factor: 1.08, allowanceSeconds: 240 },
    green_gsm_taxi: { factor: 1.08, allowanceSeconds: 240 },
    maxim_motorcycle: { factor: 1.02, allowanceSeconds: 300 },
  };
  const model = factors[mode];
  // The five-minute bucket is a demo convention, not a provider pickup-time promise.
  return Math.ceil((finiteNonNegative(roadSeconds) * model.factor + model.allowanceSeconds) / 300) * 300;
}

export function estimateAirFare(distanceMeters: number, provider: "philippine_airlines" | "cebu_pacific" | "generic_air"): DemoFare {
  const perKm = provider === "cebu_pacific" ? 2.25 : provider === "philippine_airlines" ? 2.7 : 2.4;
  const base = provider === "cebu_pacific" ? 3_000 : provider === "philippine_airlines" ? 4_000 : 3_000;
  const spread = provider === "cebu_pacific" ? 0.22 : provider === "philippine_airlines" ? 0.2 : 0.25;
  return estimateBand(base + finiteNonNegative(distanceMeters) / 1_000 * perKm, spread);
}

export function estimateAirDuration(distanceMeters: number): number {
  // Great-circle cruise-time proxy plus a fixed 2-hour planning allowance; no schedule or layover claim.
  const seconds = finiteNonNegative(distanceMeters) / 840_000 * 3_600 + 7_200;
  return Math.ceil(seconds / 1_800) * 1_800;
}

export function classifyJourney(
  origin: { countryCode?: string | null; country?: string | null; coordinates: { lat: number; lon: number } },
  destination: { countryCode?: string | null; country?: string | null; coordinates: { lat: number; lon: number } },
  isDavaoCoverage: (point: { lat: number; lon: number }) => boolean,
): JourneyType {
  const firstCountry = normalizeCountry(origin.countryCode, origin.country);
  const secondCountry = normalizeCountry(destination.countryCode, destination.country);
  if (firstCountry && secondCountry && firstCountry !== secondCountry) return "international";
  if (isDavaoCoverage(origin.coordinates) && isDavaoCoverage(destination.coordinates)) return "local";
  if (!firstCountry || !secondCountry) return "unsupported";
  return firstCountry === secondCountry ? "domestic_long_distance" : "international";
}

function normalizeCountry(countryCode?: string | null, country?: string | null): string | null {
  const code = countryCode?.trim().toUpperCase();
  if (code && /^[A-Z]{2}$/.test(code)) return code;
  const name = country?.normalize("NFKC").trim().toLocaleLowerCase();
  if (name === "philippines" || name === "republic of the philippines") return "PH";
  return name || null;
}

export type OptionSort = "cheapest" | "fastest";

export function isOptionRankable(option: TransportOption, sort: OptionSort): boolean {
  if (!option.rankingEligible[sort]) return false;
  if (sort === "cheapest") return option.fare.min !== null && option.fare.max !== null
    && Number.isFinite(option.fare.min) && Number.isFinite(option.fare.max)
    && option.fare.min >= 0 && option.fare.max >= option.fare.min;
  return option.totalDurationSeconds !== null && Number.isFinite(option.totalDurationSeconds) && option.totalDurationSeconds >= 0;
}

export function sortTransportOptions(options: readonly TransportOption[], sort: OptionSort): TransportOption[] {
  const value = (option: TransportOption): number | null => {
    if (!isOptionRankable(option, sort)) return null;
    return sort === "cheapest" ? option.fare.min : option.totalDurationSeconds;
  };
  return [...options].sort((a, b) => {
    const av = value(a);
    const bv = value(b);
    if (av === null && bv !== null) return 1;
    if (av !== null && bv === null) return -1;
    return (av ?? Number.MAX_SAFE_INTEGER) - (bv ?? Number.MAX_SAFE_INTEGER)
      || a.providerId.localeCompare(b.providerId)
      || a.id.localeCompare(b.id);
  });
}

export const providerMetadata: Record<ProviderId, ProviderMetadata> = {
  walk: { name: "Walk", transportationClass: "walking", localSvgPath: null, accent: "#ffffff" },
  jeepney: { name: "Jeepney", transportationClass: "public_transport", localSvgPath: null, accent: "#ffffff" },
  grab_taxi: { name: "Grab Taxi", transportationClass: "taxi", localSvgPath: "/brands/grab.svg", accent: "#EAF6ED" },
  green_gsm_taxi: { name: "Green GSM Taxi", transportationClass: "taxi", localSvgPath: "/brands/green-gsm.svg", accent: "#E7F5F2" },
  maxim_motorcycle: { name: "Maxim Motorcycle", transportationClass: "motorcycle", localSvgPath: "/brands/maxim.svg", accent: "#FFF0F0" },
  philippine_airlines: { name: "Philippine Airlines", transportationClass: "airline", localSvgPath: "/brands/philippine-airlines.svg", accent: "#FFF1EF" },
  cebu_pacific: { name: "Cebu Pacific", transportationClass: "airline", localSvgPath: "/brands/cebu-pacific.svg", accent: "#FFF6E4" },
  generic_air: { name: "Air journey", transportationClass: "airline", localSvgPath: null, accent: "#ffffff" },
};

export const providerNames: Record<ProviderId, string> = Object.fromEntries(
  Object.entries(providerMetadata).map(([id, metadata]) => [id, metadata.name]),
) as Record<ProviderId, string>;
