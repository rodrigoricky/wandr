import type { Coordinates, GeoLine } from "./contracts";

export function validCoordinates(value: unknown): value is Coordinates {
  if (!value || typeof value !== "object") return false;
  const point = value as Record<string, unknown>;
  return typeof point.lat === "number" && Number.isFinite(point.lat) && point.lat >= -90 && point.lat <= 90
    && typeof point.lon === "number" && Number.isFinite(point.lon) && point.lon >= -180 && point.lon <= 180;
}

export function toGeoLine(points: unknown): GeoLine | null {
  if (!Array.isArray(points) || points.length < 2) return null;
  const coordinates: [number, number][] = [];
  for (const point of points) {
    if (!Array.isArray(point) || point.length < 2) return null;
    const [lon, lat] = point;
    if (typeof lon !== "number" || typeof lat !== "number" || !Number.isFinite(lon) || !Number.isFinite(lat)
      || lon < -180 || lon > 180 || lat < -90 || lat > 90) return null;
    coordinates.push([lon, lat]);
  }
  return { type: "LineString", coordinates };
}
