import type { Coordinates, GeoGeometry, GeoLine } from "./contracts";

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

export function toGeoGeometry(value: unknown): GeoGeometry | null {
  if (!value || typeof value !== "object") return null;
  const geometry = value as Record<string, unknown>;
  if (geometry.type === "LineString") {
    const line = toGeoLine(geometry.coordinates);
    return line;
  }
  if (geometry.type !== "MultiLineString" || !Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) return null;
  const lines: [number, number][][] = [];
  for (const coordinates of geometry.coordinates) {
    const line = toGeoLine(coordinates);
    if (!line) return null;
    lines.push(line.coordinates);
  }
  return { type: "MultiLineString", coordinates: lines };
}

export function combineRouteGeometries(geometries: readonly (GeoGeometry | null | undefined)[]): GeoGeometry | null {
  const lines = geometries.flatMap((geometry) => {
    if (!geometry) return [];
    return geometry.type === "LineString" ? [geometry.coordinates] : geometry.coordinates;
  });
  if (lines.length === 0) return null;
  if (lines.length === 1) return { type: "LineString", coordinates: lines[0] };
  return { type: "MultiLineString", coordinates: lines };
}
