import type { CompareRequest, CompareResponse } from "@wandr/shared";
import { classifyJourney } from "@wandr/shared";
import { isWithinApproximateDavaoCoverage } from "../lib/validation";
import { compareAir } from "./compare-air";
import { compareLocal } from "./compare-local";
import type { Env } from "../types";

function emptyResponse(request: CompareRequest, warning: string): CompareResponse {
  return {
    origin: request.origin, destination: request.destination, generatedAt: new Date().toISOString(),
    scope: "unsupported", journeyType: "unsupported", airports: null, airRoute: null, options: [], warnings: [warning],
  };
}

export async function compare(env: Env, request: CompareRequest, signal?: AbortSignal): Promise<CompareResponse> {
  const journeyType = classifyJourney(request.origin, request.destination, isWithinApproximateDavaoCoverage);
  if (journeyType === "local") return compareLocal(env, request, signal);
  if (journeyType === "domestic_long_distance" || journeyType === "international") {
    const result = compareAir(request.origin, request.destination);
    return {
      origin: request.origin, destination: request.destination, generatedAt: new Date().toISOString(),
      scope: journeyType, journeyType, airports: result.airports, airRoute: result.airRoute,
      options: result.options, warnings: result.warning ? [result.warning] : [],
    };
  }
  return emptyResponse(request, "Country details are missing, so Wandr cannot safely classify this journey.");
}
