import type { ApiError, CompareRequest, CompareResponse, Coordinates, PlaceSuggestion } from "@wandr/shared";
import { normalizePlaceQuery } from "@wandr/shared";

const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL ?? (process.env.NODE_ENV === "development" ? "http://localhost:8787" : "")).replace(/\/$/, "");
const placeCache = new Map<string, { expiresAt: number; places: PlaceSuggestion[] }>();
const placeCacheTtlMs = 60_000;
const maxPlaceCacheEntries = 48;

function placeCacheKey(query: string, bias?: Coordinates): string {
  const point = bias ? `${bias.lat.toFixed(6)},${bias.lon.toFixed(6)}` : "default";
  return `${normalizePlaceQuery(query)}|${point}`;
}

export function getCachedPlaceSearch(query: string, bias?: Coordinates): PlaceSuggestion[] | undefined {
  const key = placeCacheKey(query, bias);
  const item = placeCache.get(key);
  if (!item) return undefined;
  if (item.expiresAt <= Date.now()) { placeCache.delete(key); return undefined; }
  return item.places;
}

function cachePlaceSearch(query: string, bias: Coordinates | undefined, places: PlaceSuggestion[]) {
  const key = placeCacheKey(query, bias);
  placeCache.delete(key);
  if (placeCache.size >= maxPlaceCacheEntries) {
    const oldest = placeCache.keys().next().value;
    if (oldest) placeCache.delete(oldest);
  }
  placeCache.set(key, { expiresAt: Date.now() + placeCacheTtlMs, places });
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!apiBase) throw new Error("The route service is not configured for this build.");
  let response: Response;
  try { response = await fetch(`${apiBase}${path}`, { ...init, headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers } }); }
  catch (error) {
    if (init?.signal?.aborted) throw new Error("Request cancelled.", { cause: error });
    throw new Error("Wandr could not reach its route service. Check your connection and retry.", { cause: error });
  }
  const payload = await response.json() as T | ApiError;
  if (!response.ok) throw new Error(typeof payload === "object" && payload !== null && "error" in payload ? payload.error.message : "The route service returned an unexpected response.");
  return payload as T;
}

export async function findPlaces(query: string, signal?: AbortSignal, bias?: Coordinates): Promise<PlaceSuggestion[]> {
  const cached = getCachedPlaceSearch(query, bias);
  if (cached) return cached;
  const params = new URLSearchParams({ q: query });
  if (bias) { params.set("lat", String(bias.lat)); params.set("lon", String(bias.lon)); }
  const response = await request<{ places: PlaceSuggestion[] }>(`/v1/places/search?${params}`, { signal });
  cachePlaceSearch(query, bias, response.places);
  return response.places;
}
export async function reverseGeocode(coordinates: Coordinates, signal?: AbortSignal): Promise<{ id: string; label: string; fallback: boolean; warning?: string }> {
  return request(`/v1/places/reverse?lat=${coordinates.lat}&lon=${coordinates.lon}`, { signal });
}
export async function compareTrip(trip: CompareRequest, signal?: AbortSignal): Promise<CompareResponse> {
  return request("/v1/trips/compare", { method: "POST", body: JSON.stringify(trip), signal });
}
