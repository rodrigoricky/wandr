import type { Coordinates, PlaceSuggestion, RouteLeg, RouteStep, TravelMode } from "@wandr/shared";
import { toGeoGeometry, validCoordinates } from "@wandr/shared";
import { ApiFailure } from "../lib/errors";
import type { Env } from "../types";

const base = "https://api.geoapify.com/v1";
const timeoutMs = 8_000;

function requireKey(env: Env): string {
  if (!env.GEOAPIFY_API_KEY) throw new ApiFailure(503, "CONFIGURATION_MISSING", "Place search and routing need a Geoapify API key. Add GEOAPIFY_API_KEY to the Worker environment.");
  return env.GEOAPIFY_API_KEY;
}

async function upstream(url: URL, signal?: AbortSignal): Promise<unknown> {
  let response: Response;
  try { response = await fetch(url, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs) }); }
  catch {
    if (signal?.aborted) throw new ApiFailure(499, "REQUEST_ABORTED", "The request was cancelled.");
    throw new ApiFailure(502, "UPSTREAM_TIMEOUT", "The mapping service did not respond. Please retry.", true);
  }
  if (response.status === 429) throw new ApiFailure(503, "UPSTREAM_QUOTA", "The mapping service is temporarily limiting requests. Please try again later.", true);
  if (!response.ok) throw new ApiFailure(502, "UPSTREAM_UNAVAILABLE", "The mapping service is temporarily unavailable.", true);
  try { return await response.json(); } catch { throw new ApiFailure(502, "UPSTREAM_INVALID_RESPONSE", "The mapping service returned an unreadable response.", true); }
}

function normalizedText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function placeRelevance(query: string, name: string, address: string): number {
  const normalizedName = normalizedText(name);
  const queryParts = query.split(" ").filter(Boolean);
  const nameParts = normalizedName.split(" ");
  if (normalizedName === query) return 500;
  if (normalizedName.startsWith(query)) return 400;
  if (nameParts.some((part) => part.startsWith(query))) return 350;
  if (queryParts.length > 1 && queryParts.every((part) => nameParts.some((namePart) => namePart.startsWith(part)))) return 300;
  const normalizedAddress = normalizedText(address);
  if (normalizedAddress.includes(query)) return 100;
  if (queryParts.length > 1 && queryParts.every((part) => normalizedAddress.includes(part))) return 50;
  return 0;
}

export async function searchPlaces(env: Env, query: string, bias?: Coordinates, signal?: AbortSignal): Promise<PlaceSuggestion[]> {
  const url = new URL(`${base}/geocode/autocomplete`);
  url.searchParams.set("text", query);
  const searchBias = bias ?? { lon: 125.612, lat: 7.073 };
  url.searchParams.set("bias", `proximity:${searchBias.lon},${searchBias.lat}`);
  url.searchParams.set("lang", "en");
  url.searchParams.set("limit", "6");
  url.searchParams.set("apiKey", requireKey(env));
  const payload = await upstream(url, signal) as { features?: unknown[] };
  if (!Array.isArray(payload.features)) return [];
  const queryText = normalizedText(query);
  const ranked = payload.features.flatMap((feature, index): { place: PlaceSuggestion; score: number; index: number }[] => {
    if (!feature || typeof feature !== "object") return [];
    const item = feature as { properties?: Record<string, unknown>; geometry?: { coordinates?: unknown } };
    const p = item.properties;
    const xy = item.geometry?.coordinates;
    if (!p || !Array.isArray(xy)) return [];
    const coordinates = { lon: typeof xy[0] === "number" ? xy[0] : p.lon, lat: typeof xy[1] === "number" ? xy[1] : p.lat };
    if (!validCoordinates(coordinates)) return [];
    const formatted = typeof p.formatted === "string" ? p.formatted.trim() : "";
    const addressLine1 = typeof p.address_line1 === "string" ? p.address_line1.trim() : "";
    const name = typeof p.name === "string" ? p.name.trim() : "";
    const label = name || addressLine1 || formatted;
    if (!label) return [];
    const secondary: string[] = [];
    for (const rawPart of [p.address_line2, p.city, p.state, p.country]) {
      if (typeof rawPart !== "string" || !rawPart.trim()) continue;
      const part = rawPart.trim();
      const normalizedPart = normalizedText(part);
      if (!normalizedPart || normalizedPart === normalizedText(label)
        || secondary.some((existing) => normalizedText(existing).includes(normalizedPart))) continue;
      secondary.push(part);
    }
    const addressLine = secondary.join(", ") || (formatted.toLocaleLowerCase() !== label.toLocaleLowerCase() ? formatted : "");
    const rawId = typeof p.place_id === "string" && p.place_id.length > 0 ? p.place_id : `${coordinates.lon.toFixed(6)},${coordinates.lat.toFixed(6)}:${normalizedText(label)}`;
    const id = `geoapify:${rawId}`;
    const rank = p.rank && typeof p.rank === "object" ? p.rank as Record<string, unknown> : {};
    const confidence = typeof rank.confidence === "number" && Number.isFinite(rank.confidence) && rank.confidence >= 0 && rank.confidence <= 1 ? rank.confidence : null;
    const category = typeof p.category === "string" ? p.category : Array.isArray(p.categories) && typeof p.categories[0] === "string" ? p.categories[0] : null;
    const place: PlaceSuggestion = {
      id,
      label,
      addressLine,
      category,
      city: typeof p.city === "string" ? p.city : null,
      country: typeof p.country === "string" ? p.country : null,
      countryCode: typeof p.country_code === "string" ? p.country_code.toUpperCase() : null,
      source: "Geoapify",
      confidence,
      coordinates,
    };
    const nameScore = placeRelevance(queryText, label, addressLine || formatted);
    return [{ place, score: nameScore + (category ? 2 : 0) + (confidence ?? 0) * 0.5, index }];
  });
  const seenIds = new Set<string>();
  const seenLocations = new Set<string>();
  return ranked.sort((a, b) => b.score - a.score || a.index - b.index).flatMap(({ place }) => {
    const locationKey = `${normalizedText(place.label)}|${place.coordinates.lon.toFixed(5)},${place.coordinates.lat.toFixed(5)}`;
    if (seenIds.has(place.id) || seenLocations.has(locationKey)) return [];
    seenIds.add(place.id);
    seenLocations.add(locationKey);
    return [place];
  }).slice(0, 6);
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

type RawObject = Record<string, unknown>;

function object(value: unknown): RawObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RawObject : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function readSteps(value: unknown, distanceUnits: string): RouteStep[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw): RouteStep[] => {
    const step = object(raw);
    const instruction = object(step?.instruction)?.text;
    if (typeof instruction !== "string" || !instruction.trim()) return [];
    let distance = numberOrNull(step?.distance);
    if (distance !== null && distanceUnits.toLowerCase() === "miles") distance *= 1609.344;
    return [{ instruction: instruction.trim(), distanceMeters: distance, durationSeconds: numberOrNull(step?.time) }];
  });
}

export function normalizeRouteFeature(value: unknown, mode: TravelMode): RouteLeg[] {
  const feature = object(value);
  const properties = object(feature?.properties);
  const rawGeometry = object(feature?.geometry);
  const distanceUnits = typeof properties?.distance_units === "string" ? properties.distance_units : "meters";
  const convertDistance = (distance: number | null): number | null =>
    distance !== null && distanceUnits.toLowerCase() === "miles" ? distance * 1609.344 : distance;
  const geometry = toGeoGeometry(rawGeometry);
  const totalDistance = convertDistance(numberOrNull(properties?.distance));
  const totalDuration = numberOrNull(properties?.time);
  if (!geometry || totalDistance === null || totalDuration === null || totalDistance <= 0 || totalDuration <= 0) return [];

  const rawLegs = Array.isArray(properties?.legs) ? properties.legs.map(object) : [];
  const lines = geometry.type === "LineString" ? [geometry.coordinates] : geometry.coordinates;
  if (geometry.type === "MultiLineString" && rawLegs.length === lines.length && rawLegs.length > 0) {
    const legs = rawLegs.map((leg, index): RouteLeg => {
      const distance = convertDistance(numberOrNull(leg?.distance));
      return {
        mode,
        title: mode === "walk" ? "Walking route" : "Driving route estimate",
        distanceMeters: distance,
        durationSeconds: numberOrNull(leg?.time),
        geometry: { type: "LineString", coordinates: lines[index] },
        steps: readSteps(leg?.steps, distanceUnits),
        source: "Geoapify Routing",
      };
    });
    return legs;
  }

  const steps = rawLegs.flatMap((leg) => readSteps(leg?.steps, distanceUnits));
  return [{
    mode,
    title: mode === "walk" ? "Walking route" : "Driving route estimate",
    distanceMeters: totalDistance,
    durationSeconds: totalDuration,
    geometry,
    steps,
    source: "Geoapify Routing",
  }];
}

export async function route(env: Env, mode: TravelMode, origin: Coordinates, destination: Coordinates, signal?: AbortSignal): Promise<RouteLeg[]> {
  const url = new URL(`${base}/routing`);
  url.searchParams.set("waypoints", `${origin.lat},${origin.lon}|${destination.lat},${destination.lon}`);
  url.searchParams.set("mode", mode);
  url.searchParams.set("units", "metric");
  url.searchParams.set("lang", "en");
  url.searchParams.set("details", "instruction_details");
  url.searchParams.set("apiKey", requireKey(env));
  const payload = object(await upstream(url, signal));
  const features = Array.isArray(payload?.features) ? payload.features : [];
  const legs = normalizeRouteFeature(features[0], mode);
  if (legs.length === 0) {
    throw new ApiFailure(404, "NO_SUPPORTED_ROUTE", `No ${mode === "walk" ? "walking" : "driving"} route was found between these places.`, true);
  }
  return legs;
}
