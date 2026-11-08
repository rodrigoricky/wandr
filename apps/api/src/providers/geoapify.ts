import type { Coordinates, PlaceSuggestion, RouteLeg, TravelMode } from "@wandr/shared";
import { toGeoLine } from "@wandr/shared";
import { ApiFailure } from "../lib/errors";
import type { Env } from "../types";

const base = "https://api.geoapify.com/v1";
const timeoutMs = 8_000;

function requireKey(env: Env): string {
  if (!env.GEOAPIFY_API_KEY) throw new ApiFailure(503, "CONFIGURATION_MISSING", "Place search and routing need a Geoapify API key. Add GEOAPIFY_API_KEY to the Worker environment.");
  return env.GEOAPIFY_API_KEY;
}

async function upstream(url: URL): Promise<unknown> {
  let response: Response;
  try { response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) }); }
  catch { throw new ApiFailure(502, "UPSTREAM_TIMEOUT", "The mapping service did not respond. Please retry.", true); }
  if (response.status === 429) throw new ApiFailure(503, "UPSTREAM_QUOTA", "The mapping service is temporarily limiting requests. Please try again later.", true);
  if (!response.ok) throw new ApiFailure(502, "UPSTREAM_UNAVAILABLE", "The mapping service is temporarily unavailable.", true);
  try { return await response.json(); } catch { throw new ApiFailure(502, "UPSTREAM_INVALID_RESPONSE", "The mapping service returned an unreadable response.", true); }
}

export async function searchPlaces(env: Env, query: string): Promise<PlaceSuggestion[]> {
  const url = new URL(`${base}/geocode/autocomplete`);
  url.searchParams.set("text", query);
  url.searchParams.set("filter", "rect:125.15,6.85,125.85,7.5");
  url.searchParams.set("bias", "proximity:125.612,7.073");
  url.searchParams.set("lang", "en");
  url.searchParams.set("limit", "6");
  url.searchParams.set("apiKey", requireKey(env));
  const payload = await upstream(url) as { features?: unknown[] };
  if (!Array.isArray(payload.features)) return [];
  return payload.features.flatMap((feature): PlaceSuggestion[] => {
    if (!feature || typeof feature !== "object") return [];
    const item = feature as { properties?: Record<string, unknown>; geometry?: { coordinates?: unknown } };
    const p = item.properties;
    const xy = item.geometry?.coordinates;
    if (!p || !Array.isArray(xy) || typeof xy[0] !== "number" || typeof xy[1] !== "number" || !Number.isFinite(xy[0]) || !Number.isFinite(xy[1])) return [];
    const label = typeof p.formatted === "string" ? p.formatted : "";
    const id = typeof p.place_id === "string" ? p.place_id : "";
    if (!label || !id) return [];
    return [{ id, label, addressLine: label, coordinates: { lon: xy[0], lat: xy[1] } }];
  });
}

export async function reversePlace(env: Env, coordinates: Coordinates): Promise<{ id: string; label: string; fallback: boolean; warning?: string }> {
  const url = new URL(`${base}/geocode/reverse`);
  url.searchParams.set("lat", String(coordinates.lat));
  url.searchParams.set("lon", String(coordinates.lon));
  url.searchParams.set("lang", "en");
  url.searchParams.set("apiKey", requireKey(env));
  const payload = await upstream(url) as { features?: { properties?: { place_id?: string; formatted?: string } }[] };
  const first = payload.features?.[0]?.properties;
  if (!first?.formatted) return { id: `gps:${coordinates.lat.toFixed(5)},${coordinates.lon.toFixed(5)}`, label: `${coordinates.lat.toFixed(5)}, ${coordinates.lon.toFixed(5)}`, fallback: true, warning: "Place name unavailable; showing coordinates only." };
  return { id: first.place_id ?? `geoapify:${coordinates.lat.toFixed(5)},${coordinates.lon.toFixed(5)}`, label: first.formatted, fallback: false };
}

export async function route(env: Env, mode: TravelMode, origin: Coordinates, destination: Coordinates): Promise<RouteLeg> {
  const url = new URL(`${base}/routing`);
  url.searchParams.set("waypoints", `${origin.lat},${origin.lon}|${destination.lat},${destination.lon}`);
  url.searchParams.set("mode", mode);
  url.searchParams.set("apiKey", requireKey(env));
  const payload = await upstream(url) as { features?: { geometry?: { type?: string; coordinates?: unknown }; properties?: { distance?: number; time?: number } }[] };
  const feature = payload.features?.[0];
  const coordinates = feature?.geometry?.type === "LineString" ? feature.geometry.coordinates : null;
  const geometry = toGeoLine(coordinates);
  const distance = feature?.properties?.distance;
  const duration = feature?.properties?.time;
  if (!geometry || typeof distance !== "number" || !Number.isFinite(distance) || typeof duration !== "number" || !Number.isFinite(duration)) {
    throw new ApiFailure(404, "NO_SUPPORTED_ROUTE", `No ${mode === "walk" ? "walking" : "driving"} route was found between these places.`, true);
  }
  return { mode, title: mode === "walk" ? "Walking route" : "Driving route estimate", distanceMeters: distance, durationSeconds: duration, geometry, source: "Geoapify Routing" };
}
