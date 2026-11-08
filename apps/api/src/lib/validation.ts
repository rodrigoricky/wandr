import type { CompareRequest, Place } from "@wandr/shared";
import { validCoordinates } from "@wandr/shared";
import { ApiFailure } from "./errors";

const approximateDavaoCoverage = { minLat: 6.85, maxLat: 7.5, minLon: 125.15, maxLon: 125.85 };

export function isWithinApproximateDavaoCoverage(point: { lat: number; lon: number }): boolean {
  return point.lat >= approximateDavaoCoverage.minLat && point.lat <= approximateDavaoCoverage.maxLat
    && point.lon >= approximateDavaoCoverage.minLon && point.lon <= approximateDavaoCoverage.maxLon;
}

export function validatePlace(value: unknown, key: string): Place {
  if (!value || typeof value !== "object") throw new ApiFailure(400, "INVALID_INPUT", `${key} must be a selected place.`);
  const place = value as Record<string, unknown>;
  if (typeof place.id !== "string" || place.id.length < 1 || place.id.length > 300
    || typeof place.label !== "string" || place.label.length < 1 || place.label.length > 300
    || !validCoordinates(place.coordinates)) throw new ApiFailure(400, "INVALID_INPUT", `${key} must include a valid label and coordinates.`);
  const point = place.coordinates;
  return {
    id: place.id,
    label: place.label,
    coordinates: { lat: point.lat, lon: point.lon },
    ...(typeof place.addressLine === "string" ? { addressLine: place.addressLine } : {}),
    ...(typeof place.category === "string" || place.category === null ? { category: place.category } : {}),
    ...(typeof place.city === "string" || place.city === null ? { city: place.city } : {}),
    ...(typeof place.country === "string" || place.country === null ? { country: place.country } : {}),
    ...(typeof place.countryCode === "string" || place.countryCode === null ? { countryCode: place.countryCode } : {}),
    ...(typeof place.source === "string" ? { source: place.source } : {}),
    ...(typeof place.confidence === "number" && Number.isFinite(place.confidence) && place.confidence >= 0 && place.confidence <= 1 ? { confidence: place.confidence } : {}),
  };
}

export async function readCompareRequest(request: Request): Promise<CompareRequest> {
  if (!request.headers.get("Content-Type")?.toLowerCase().includes("application/json")) throw new ApiFailure(415, "INVALID_CONTENT_TYPE", "Send this request as JSON.");
  const text = await request.text();
  if (text.length > 12_000) throw new ApiFailure(413, "REQUEST_TOO_LARGE", "This trip request is too large.");
  let body: unknown;
  try { body = JSON.parse(text); } catch { throw new ApiFailure(400, "INVALID_INPUT", "The trip request is not valid JSON."); }
  if (!body || typeof body !== "object") throw new ApiFailure(400, "INVALID_INPUT", "Choose an origin and destination.");
  const data = body as Record<string, unknown>;
  const origin = validatePlace(data.origin, "Origin");
  const destination = validatePlace(data.destination, "Destination");
  if (origin.id === destination.id || (origin.coordinates.lat === destination.coordinates.lat && origin.coordinates.lon === destination.coordinates.lon)) {
    throw new ApiFailure(400, "SAME_PLACE", "Choose two different places.");
  }
  return { origin, destination };
}
