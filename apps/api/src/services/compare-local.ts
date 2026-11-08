import type { CompareRequest, CompareResponse, OptionMode, TransportOption } from "@wandr/shared";
import { DEMO_ESTIMATE_VERSION, estimateJeepneyFare, estimateRoadDuration, estimateRoadFare } from "@wandr/shared";
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
  mode: Exclude<OptionMode, "walk" | "flight" | "jeepney">,
  title: string,
  providerId: "generic_taxi" | "generic_motorcycle" | "generic_car",
  roadLegs: TransportOption["legs"],
  distance: number,
  duration: number,
): TransportOption {
  const fare = estimateRoadFare(mode, distance, duration);
  const totalDurationSeconds = estimateRoadDuration(mode, duration);
  const names = { taxi: "Taxi demo model", motorcycle: "Motorcycle demo model", car_ride: "Car-ride demo model" };
  const assumptions = {
    taxi: "Reported 2026 regular-taxi ₱65 flag-down, ₱13.50/km and ₱2/min rates; applying them to a routed road estimate does not verify a fare, meter, vehicle or availability.",
    motorcycle: "Demo-only ₱30 base, ₱9/km, and ₱0.60/min assumptions; no provider, vehicle, availability, or quote is verified.",
    car_ride: "Demo-only ₱55 base, ₱16/km, and ₱1.60/min assumptions; no provider, vehicle, availability, or quote is verified.",
  };
  return {
    id: `demo-${mode}`, title, mode, providerId, legs: roadLegs,
    fare: estimatedFare(fare.min, fare.max, names[mode], mode === "taxi" ? "https://ptvnews.ph/ltfrb-releases-new-matrices-for-puv-fare-hikes-effective-sept-28/" : null, mode === "taxi" ? "2026-09-28" : null),
    totalDurationSeconds,
    totalWalkingMeters: 0,
    transfers: null,
    availability: "estimated_demo",
    estimate: { kind: "demo_model", modelId: `local-${mode}`, version: DEMO_ESTIMATE_VERSION, basis: "Geoapify driving distance/time with centralized demo pricing assumptions.", note: assumptions[mode] },
    note: "Geoapify road geometry is a map reference only. This is not a verified passenger route or pickup/drop-off estimate.",
    rankingEligible: { cheapest: true, fastest: true },
  };
}

function jeepneyEstimate(roadLegs: TransportOption["legs"], distance: number, duration: number): TransportOption {
  const fare = estimateJeepneyFare(distance);
  const totalDurationSeconds = Math.ceil((duration * 1.45 + 300) / 300) * 300;
  return {
    id: "demo-jeepney", title: "Jeepney estimate", mode: "jeepney", providerId: "jeepney", legs: roadLegs,
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
        roadEstimate("taxi", "Taxi estimate", "generic_taxi", roadLegs, totals.distance, totals.duration),
        roadEstimate("car_ride", "Car ride estimate", "generic_car", roadLegs, totals.distance, totals.duration),
        roadEstimate("motorcycle", "Motorcycle estimate", "generic_motorcycle", roadLegs, totals.distance, totals.duration),
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
