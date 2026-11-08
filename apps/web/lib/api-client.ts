import type { ApiError, CompareRequest, CompareResponse, Coordinates, PlaceSuggestion } from "@wandr/shared";

const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8787").replace(/\/$/, "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try { response = await fetch(`${apiBase}${path}`, { ...init, headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers } }); }
  catch { throw new Error("Wandr could not reach its route service. Check your connection and retry."); }
  const payload = await response.json() as T | ApiError;
  if (!response.ok) throw new Error(typeof payload === "object" && payload !== null && "error" in payload ? payload.error.message : "The route service returned an unexpected response.");
  return payload as T;
}

export async function findPlaces(query: string, signal?: AbortSignal): Promise<PlaceSuggestion[]> {
  const response = await request<{ places: PlaceSuggestion[] }>(`/v1/places/search?q=${encodeURIComponent(query)}`, { signal });
  return response.places;
}
export async function reverseGeocode(coordinates: Coordinates, signal?: AbortSignal): Promise<{ id: string; label: string; fallback: boolean; warning?: string }> {
  return request(`/v1/places/reverse?lat=${coordinates.lat}&lon=${coordinates.lon}`, { signal });
}
export async function compareTrip(trip: CompareRequest, signal?: AbortSignal): Promise<CompareResponse> {
  return request("/v1/trips/compare", { method: "POST", body: JSON.stringify(trip), signal });
}
