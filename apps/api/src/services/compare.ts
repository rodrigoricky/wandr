import type { CompareRequest, CompareResponse, TransportOption } from "@wandr/shared";
import { route } from "../providers/geoapify";
import { ApiFailure } from "../lib/errors";
import { isWithinApproximateDavaoCoverage } from "../lib/validation";
import type { Env } from "../types";

const MAX_DEFAULT_WALK_METERS = 1_500;
const MAX_DEFAULT_WALK_SECONDS = 25 * 60;

export async function compare(env: Env, request: CompareRequest, signal?: AbortSignal): Promise<CompareResponse> {
  if (!isWithinApproximateDavaoCoverage(request.origin.coordinates) || !isWithinApproximateDavaoCoverage(request.destination.coordinates)) {
    return {
      origin: request.origin,
      destination: request.destination,
      generatedAt: new Date().toISOString(),
      scope: "unsupported",
      options: [],
      warnings: ["Place found; transport comparison is not supported for this journey yet. Wandr cannot compare verified fares or passenger services here."],
    };
  }
  const attempts = await Promise.allSettled([
    route(env, "walk", request.origin.coordinates, request.destination.coordinates, signal),
    route(env, "drive", request.origin.coordinates, request.destination.coordinates, signal),
  ]);
  if (signal?.aborted) throw new ApiFailure(499, "REQUEST_ABORTED", "The request was cancelled.");
  const options: TransportOption[] = [];
  const warnings: string[] = ["No verified Davao public-transport routes or fare rules are currently available. Taxi and ride-hailing availability and prices are not established."];
  for (const [index, attempt] of attempts.entries()) {
    const mode = index === 0 ? "walk" : "drive";
    if (attempt.status === "rejected") {
      if (attempt.reason instanceof ApiFailure && attempt.reason.code === "CONFIGURATION_MISSING") throw attempt.reason;
      warnings.push(attempt.reason instanceof ApiFailure ? attempt.reason.message : `A ${mode} route could not be loaded.`);
      continue;
    }
    const legs = attempt.value;
    const isWalk = mode === "walk";
    const totalDurationSeconds = legs.every((leg) => leg.durationSeconds !== null)
      ? legs.reduce((sum, leg) => sum + (leg.durationSeconds ?? 0), 0)
      : null;
    const totalDistanceMeters = legs.every((leg) => leg.distanceMeters !== null)
      ? legs.reduce((sum, leg) => sum + (leg.distanceMeters ?? 0), 0)
      : null;
    if (isWalk && (totalDistanceMeters === null || totalDurationSeconds === null || totalDistanceMeters > MAX_DEFAULT_WALK_METERS || totalDurationSeconds > MAX_DEFAULT_WALK_SECONDS)) {
      warnings.push("A walking route was found but is longer than Wandr’s short-walk comparison limit, so it is not shown as the default money-saving option.");
      continue;
    }
    options.push({
      id: `geoapify-${mode}`,
      title: isWalk ? "Walk" : "Drive estimate",
      mode,
      legs,
      fare: isWalk
        ? { currency: "PHP", min: 0, max: 0, status: "published_rule", sourceName: "No motorized transport", sourceUrl: null, checkedAt: null }
        : { currency: "PHP", min: null, max: null, status: "unknown", sourceName: null, sourceUrl: null, checkedAt: null },
      totalDurationSeconds,
      totalWalkingMeters: isWalk ? totalDistanceMeters : 0,
      transfers: 0,
      availability: isWalk ? "verified_route" : "estimated_road_route",
      note: isWalk ? "Routed pedestrian path. Path availability does not establish accessibility or safety." : "Road driving duration only; this does not establish taxi availability, fare, pickup time, or a complete passenger journey.",
      rankingEligible: { cheapest: isWalk, fastest: isWalk },
    });
  }
  if (!options.length) {
    const upstreamFailure = attempts.find((attempt) => attempt.status === "rejected" && attempt.reason instanceof ApiFailure && ["UPSTREAM_TIMEOUT", "UPSTREAM_QUOTA", "UPSTREAM_UNAVAILABLE"].includes(attempt.reason.code));
    if (upstreamFailure?.status === "rejected" && upstreamFailure.reason instanceof ApiFailure) throw upstreamFailure.reason;
    throw new ApiFailure(404, "NO_SUPPORTED_ROUTE", "No supported walking or driving route was found between these places.", true);
  }
  if (options.length < 2) warnings.push("Only partial route results are available. Unavailable options are not shown.");
  return { origin: request.origin, destination: request.destination, generatedAt: new Date().toISOString(), scope: "davao_city", options, warnings };
}
