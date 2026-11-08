import { errorResponse, ApiFailure } from "./lib/errors";
import { corsHeaders } from "./lib/cors";
import { readCompareRequest } from "./lib/validation";
import { compare } from "./services/compare";
import { reversePlace, searchPlaces } from "./providers/geoapify";
import type { Env } from "./types";
import { validCoordinates } from "@wandr/shared";

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    try {
      const url = new URL(request.url);
      let response: Response;
      if (request.method === "GET" && url.pathname === "/v1/health") {
        response = Response.json({ status: "ok", providersProbed: false, configured: { geoapify: Boolean(env.GEOAPIFY_API_KEY) } });
      } else if (url.pathname.startsWith("/v1/") && env.API_LIMITER) {
        const key = request.headers.get("CF-Connecting-IP") ?? "local-development";
        const limit = await env.API_LIMITER.limit({ key });
        if (!limit.success) throw new ApiFailure(429, "RATE_LIMITED", "Too many requests. Please wait a moment and retry.", true);
        response = await handleApiRoute(request, env, url);
      } else {
        response = await handleApiRoute(request, env, url);
      }
      cors.forEach((value, key) => response.headers.set(key, value));
      response.headers.set("Cache-Control", "no-store");
      return response;
    } catch (error) {
      const response = errorResponse(error);
      cors.forEach((value, key) => response.headers.set(key, value));
      response.headers.set("Cache-Control", "no-store");
      return response;
    }
  },
};

async function handleApiRoute(request: Request, env: Env, url: URL): Promise<Response> {
  if (request.method === "GET" && url.pathname === "/v1/places/search") {
    const query = url.searchParams.get("q")?.trim() ?? "";
    if (query.length < 2 || query.length > 120) throw new ApiFailure(400, "INVALID_INPUT", "Enter between 2 and 120 characters to search.");
    return Response.json({ places: await searchPlaces(env, query) });
  }
  if (request.method === "GET" && url.pathname === "/v1/places/reverse") {
    const lat = Number(url.searchParams.get("lat"));
    const lon = Number(url.searchParams.get("lon"));
    const coordinates = { lat, lon };
    if (!validCoordinates(coordinates)) throw new ApiFailure(400, "INVALID_INPUT", "Enter valid GPS coordinates.");
    try {
      const result = await reversePlace(env, coordinates);
      return Response.json({ ...result, ...(result.fallback ? { warning: result.warning } : {}) });
    } catch (error) {
      if (!(error instanceof ApiFailure) || !["CONFIGURATION_MISSING", "UPSTREAM_TIMEOUT", "UPSTREAM_UNAVAILABLE", "UPSTREAM_QUOTA"].includes(error.code)) throw error;
      return Response.json({ id: `gps:${lat.toFixed(5)},${lon.toFixed(5)}`, label: `${lat.toFixed(5)}, ${lon.toFixed(5)}`, fallback: true, warning: "Place name unavailable; showing coordinates only." });
    }
  }
  if (request.method === "POST" && url.pathname === "/v1/trips/compare") return Response.json(await compare(env, await readCompareRequest(request), request.signal));
  throw new ApiFailure(404, "NOT_FOUND", "This Wandr API endpoint was not found.");
}

export default worker;
