import type { CompareRequest, CompareResponse, TransportOption } from "@wandr/shared";
import { route } from "../providers/geoapify";
import { ApiFailure } from "../lib/errors";
import type { Env } from "../types";

export async function compare(env: Env, request: CompareRequest): Promise<CompareResponse> {
  const attempts = await Promise.allSettled([
    route(env, "walk", request.origin.coordinates, request.destination.coordinates),
    route(env, "drive", request.origin.coordinates, request.destination.coordinates),
  ]);
  const options: TransportOption[] = [];
  const warnings: string[] = ["No verified Davao public-transport routes or fare rules are currently available. Taxi and ride-hailing availability and prices are not established."];
  for (const [index, attempt] of attempts.entries()) {
    const mode = index === 0 ? "walk" : "drive";
    if (attempt.status === "rejected") {
      if (attempt.reason instanceof ApiFailure && attempt.reason.code === "CONFIGURATION_MISSING") throw attempt.reason;
      warnings.push(attempt.reason instanceof ApiFailure ? attempt.reason.message : `A ${mode} route could not be loaded.`);
      continue;
    }
    const leg = attempt.value;
    const isWalk = mode === "walk";
    options.push({
      id: `geoapify-${mode}`,
      title: isWalk ? "Walk" : "Drive estimate",
      mode,
      legs: [leg],
      fare: isWalk
        ? { currency: "PHP", min: 0, max: 0, status: "published_rule", sourceName: "No motorized transport", sourceUrl: null, checkedAt: null }
        : { currency: "PHP", min: null, max: null, status: "unknown", sourceName: null, sourceUrl: null, checkedAt: null },
      totalDurationSeconds: leg.durationSeconds,
      totalWalkingMeters: isWalk ? leg.distanceMeters : 0,
      transfers: 0,
      availability: isWalk ? "verified_route" : "estimated_road_route",
      note: isWalk ? "Routed pedestrian path. Path availability does not establish accessibility or safety." : "Road driving duration only; this does not establish taxi availability, fare, pickup time, or a complete passenger journey.",
      rankingEligible: { cheapest: isWalk, fastest: true },
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
