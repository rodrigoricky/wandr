import type { CompareRequest, CompareResponse, OptionMode, ProviderId, TransportOption } from "@wandr/shared";
import { DEMO_ESTIMATE_VERSION, estimateJeepneyFare, estimateRoadDuration, estimateRoadFare, providerNames } from "@wandr/shared";
import { ApiFailure } from "../lib/errors";
import { route } from "../providers/geoapify";
import type { Env } from "../types";

const MAX_DEFAULT_WALK_METERS = 1_500;
const MAX_DEFAULT_WALK_SECONDS = 25 * 60;
const JEEPNEY_MAX_DISTANCE_METERS = 30_000;

function routeTotals(legs: TransportOption["legs"]): { distance: number | null; duration: number | null } {
  return {
    distance: legs.every((leg) => leg.distanceMeters !== null) ? legs.reduce((sum, leg) => sum + (leg.distanceMeters ?? 0), 0) : null,
    duration: legs.every((leg) => leg.durationSeconds !== null) ? legs.reduce((sum, leg) => sum + (leg.durationSeconds ?? 0), 0) : null,
  };
}

function estimatedFare(min: number, max: number, sourceName: string, sourceUrl: string | null = null, checkedAt: string | null = null) {
  return { currency: "PHP" as const, min, max, status: "estimated" as const, sourceName, sourceUrl, checkedAt };
}

function roadEstimate(
  providerId: Extract<ProviderId, "grab_taxi" | "green_gsm_taxi" | "maxim_motorcycle">,
  roadLegs: TransportOption["legs"],
  distance: number,
  duration: number,
): TransportOption {
  const mode: Extract<OptionMode, "taxi" | "motorcycle"> = providerId === "maxim_motorcycle" ? "motorcycle" : "taxi";
  const fare = estimateRoadFare(providerId, distance, duration);
  const totalDurationSeconds = estimateRoadDuration(providerId, duration);
  const assumptions = {
    grab_taxi: "Wandr demo coefficients: ₱70 base, ₱15/km, and ₱2.50/min. No Grab quote, driver, vehicle, availability, or service is verified.",
    green_gsm_taxi: "Wandr demo coefficients: ₱65 base, ₱13.50/km, and ₱2/min. No Green GSM quote, driver, vehicle, availability, or service is verified.",
    maxim_motorcycle: "Wandr demo coefficients: ₱30 base, ₱9/km, and ₱0.60/min. No Maxim quote, driver, vehicle, availability, or service is verified.",
  };
  return {
    id: `demo-${providerId}`, title: providerNames[providerId], mode, providerId, legs: roadLegs,
    fare: estimatedFare(fare.min, fare.max, `Wandr ${providerNames[providerId]} demo model`),
    totalDurationSeconds,
    totalWalkingMeters: 0,
    transfers: null,
    availability: "estimated_demo",
    estimate: { kind: "demo_model", modelId: `local-${providerId}`, version: DEMO_ESTIMATE_VERSION, basis: "Geoapify driving distance/time with deterministic Wandr demo coefficients; not an operator quote.", note: assumptions[providerId] },
    note: "Geoapify road geometry is a map reference only. This is not a verified passenger route or pickup/drop-off estimate.",
    rankingEligible: { cheapest: true, fastest: true },
  };
}

function jeepneyEstimate(roadLegs: TransportOption["legs"], distance: number, duration: number): TransportOption {
  const fare = estimateJeepneyFare(distance);
  const totalDurationSeconds = Math.ceil((duration * 1.45 + 300) / 300) * 300;
  return {
    id: "demo-jeepney", title: "Jeepney", mode: "jeepney", providerId: "jeepney", legs: roadLegs,
    fare: estimatedFare(fare, fare, "Reported 2026 PUJ rate · demo distance input", "https://ptvnews.ph/ltfrb-releases-new-matrices-for-puv-fare-hikes-effective-sept-28/", "2026-09-28"),
    totalDurationSeconds,
    totalWalkingMeters: 0,
    transfers: null,
    availability: "estimated_demo",
    estimate: {
      kind: "demo_model", modelId: "davao-jeepney-reference", version: DEMO_ESTIMATE_VERSION,
      basis: "Traditional PUJ ₱14 first 4 km plus ₱2 for each succeeding kilometre (PTV/LTFRB report, effective 2026-09-28); Geoapify road distance is only an illustrative fare input.",
      note: "Conditional fare reference only. Jeepney route coverage, ridden distance, boarding points, transfers, availability and time are not verified; no boarding directions are supplied.",
    },
    note: "Conditional fare reference only; no jeepney service or stop route is claimed.",
    rankingEligible: { cheapest: true, fastest: true },
  };
}

export async function compareLocal(env: Env, request: CompareRequest, signal?: AbortSignal): Promise<CompareResponse> {
  const attempts = await Promise.allSettled([
    Promise.resolve().then(() => route(env, "walk", request.origin.coordinates, request.destination.coordinates, signal)),
    Promise.resolve().then(() => route(env, "drive", request.origin.coordinates, request.destination.coordinates, signal)),
  ]);
  if (signal?.aborted) throw new ApiFailure(499, "REQUEST_ABORTED", "The request was cancelled.");
  const options: TransportOption[] = [];
  const warnings: string[] = [];
  const walkingAttempt = attempts[0];
  const roadAttempt = attempts[1];

  if (walkingAttempt.status === "fulfilled") {
    const totals = routeTotals(walkingAttempt.value);
    if (totals.distance !== null && totals.duration !== null && totals.distance <= MAX_DEFAULT_WALK_METERS && totals.duration <= MAX_DEFAULT_WALK_SECONDS) {
      options.push({
        id: "geoapify-walk", title: "Walk", mode: "walk", providerId: "walk", legs: walkingAttempt.value,
        fare: { currency: "PHP", min: 0, max: 0, status: "published_rule", sourceName: "Walking; no motor fare", sourceUrl: null, checkedAt: null },
        totalDurationSeconds: totals.duration, totalWalkingMeters: totals.distance, transfers: 0, availability: "verified_route",
        note: "Geoapify pedestrian path. Route availability does not establish safety or accessibility.",
        rankingEligible: { cheapest: true, fastest: true },
      });
    }
  }

  if (roadAttempt.status === "fulfilled") {
    const roadLegs = roadAttempt.value;
    const totals = routeTotals(roadLegs);
    if (totals.distance !== null && totals.duration !== null && totals.distance > 0 && totals.duration > 0) {
      options.push(
        roadEstimate("grab_taxi", roadLegs, totals.distance, totals.duration),
        roadEstimate("green_gsm_taxi", roadLegs, totals.distance, totals.duration),
        roadEstimate("maxim_motorcycle", roadLegs, totals.distance, totals.duration),
      );
      if (totals.distance <= JEEPNEY_MAX_DISTANCE_METERS) options.push(jeepneyEstimate(roadLegs, totals.distance, totals.duration));
    }
  } else if (options.length > 0) {
    warnings.push("Motorized estimates are unavailable because the road route could not be loaded.");
  }

  if (!options.length) {
    const upstreamFailure = attempts.find((attempt) => attempt.status === "rejected" && attempt.reason instanceof ApiFailure && ["CONFIGURATION_MISSING", "UPSTREAM_TIMEOUT", "UPSTREAM_QUOTA", "UPSTREAM_UNAVAILABLE"].includes(attempt.reason.code));
    if (upstreamFailure?.status === "rejected" && upstreamFailure.reason instanceof ApiFailure) throw upstreamFailure.reason;
    throw new ApiFailure(404, "NO_SUPPORTED_ROUTE", "No walking or road route could be loaded for these places.", true);
  }

  return {
    origin: request.origin, destination: request.destination, generatedAt: new Date().toISOString(),
    scope: "davao_city", journeyType: "local", airports: null, airRoute: null, options, warnings,
  };
}
