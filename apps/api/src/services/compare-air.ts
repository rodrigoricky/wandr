import type { AirRoutePreview, Airport, Place, ProviderId, TransportOption } from "@wandr/shared";
import { DEMO_ESTIMATE_VERSION, estimateAirDuration, estimateAirFare } from "@wandr/shared";
import { distanceBetween, resolveAirport } from "../data/airport-index";

type Vector = [number, number, number];

function unit(point: { lat: number; lon: number }): Vector {
  const lat = point.lat * Math.PI / 180;
  const lon = point.lon * Math.PI / 180;
  return [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
}

function normalizeLongitude(lon: number): number {
  return ((lon + 540) % 360) - 180;
}

function greatCirclePoint(start: Vector, end: Vector, fraction: number): [number, number] {
  const dot = Math.min(1, Math.max(-1, start[0] * end[0] + start[1] * end[1] + start[2] * end[2]));
  const omega = Math.acos(dot);
  const sinOmega = Math.sin(omega);
  const a = sinOmega === 0 ? 1 - fraction : Math.sin((1 - fraction) * omega) / sinOmega;
  const b = sinOmega === 0 ? fraction : Math.sin(fraction * omega) / sinOmega;
  const x = a * start[0] + b * end[0];
  const y = a * start[1] + b * end[1];
  const z = a * start[2] + b * end[2];
  return [normalizeLongitude(Math.atan2(y, x) * 180 / Math.PI), Math.atan2(z, Math.hypot(x, y)) * 180 / Math.PI];
}

function splitAtAntimeridian(points: [number, number][]): [number, number][][] {
  const lines: [number, number][][] = [];
  let current: [number, number][] = [];
  for (const point of points) {
    const previous = current.at(-1);
    if (previous && Math.abs(point[0] - previous[0]) > 180) {
      const crossesEast = previous[0] > 0;
      const adjustedLongitude = point[0] + (crossesEast ? 360 : -360);
      const edge = crossesEast ? 180 : -180;
      const fraction = (edge - previous[0]) / (adjustedLongitude - previous[0]);
      const crossing: [number, number] = [edge, previous[1] + (point[1] - previous[1]) * fraction];
      current.push(crossing);
      if (current.length >= 2) lines.push(current);
      current = [[-edge, crossing[1]], point];
    } else current.push(point);
  }
  if (current.length >= 2) lines.push(current);
  return lines;
}

export function greatCircleGeometry(origin: Airport, destination: Airport) {
  const distanceMeters = distanceBetween(origin.coordinates, destination.coordinates);
  const segments = Math.max(20, Math.ceil(distanceMeters / 200_000));
  const start = unit(origin.coordinates);
  const end = unit(destination.coordinates);
  const points = Array.from({ length: segments + 1 }, (_, index) => greatCirclePoint(start, end, index / segments));
  const lines = splitAtAntimeridian(points);
  return {
    geometry: lines.length === 1 ? { type: "LineString" as const, coordinates: lines[0] } : { type: "MultiLineString" as const, coordinates: lines },
    distanceMeters,
  };
}

function airlineOption(providerId: ProviderId, provider: "philippine_airlines" | "cebu_pacific" | "generic_air", distanceMeters: number): TransportOption {
  const fare = estimateAirFare(distanceMeters, provider);
  const duration = estimateAirDuration(distanceMeters);
  const airlineLabel = provider === "philippine_airlines" ? "Philippine Airlines" : provider === "cebu_pacific" ? "Cebu Pacific" : "Air journey";
  return {
    id: `air-${provider}`,
    title: provider === "generic_air" ? "Air journey estimate" : `${airlineLabel} reference`,
    mode: "flight",
    providerId,
    legs: [],
    fare: { currency: "PHP", min: fare.min, max: fare.max, status: "estimated", sourceName: "Wandr distance-based demo model", sourceUrl: null, checkedAt: null },
    totalDurationSeconds: duration,
    totalWalkingMeters: 0,
    transfers: null,
    availability: "estimated_demo",
    estimate: {
      kind: "demo_model",
      modelId: `air-${provider}`,
      version: DEMO_ESTIMATE_VERSION,
      basis: "Great-circle distance with a provider-reference multiplier and five-minute time bands.",
      note: "Illustrative PHP estimate only. No airline route, nonstop service, schedule, date-specific price, layover, or seat availability is verified.",
    },
    note: "Geographic air corridor only; origin and destination airport ground trips are not included.",
    rankingEligible: { cheapest: true, fastest: true },
  };
}

export function compareAir(origin: Place, destination: Place): {
  airports: { origin: Airport; destination: Airport } | null;
  airRoute: AirRoutePreview | null;
  options: TransportOption[];
  warning: string | null;
} {
  const first = resolveAirport(origin);
  const last = resolveAirport(destination);
  if (!first || !last) {
    return { airports: null, airRoute: null, options: [], warning: "A suitable scheduled-service airport could not be resolved near both selected places." };
  }
  if (first.iata === last.iata) {
    return { airports: null, airRoute: null, options: [], warning: "Both selected places resolve to the same airport; choose a different destination for an air comparison." };
  }
  const { geometry, distanceMeters } = greatCircleGeometry(first, last);
  const airRoute: AirRoutePreview = {
    geometry,
    distanceMeters,
    durationSeconds: estimateAirDuration(distanceMeters),
    source: "great_circle_preview",
    note: "Schematic great-circle corridor between nearby airports. It is not a flight track, nonstop-service claim, or schedule.",
  };
  const philippinesPair = first.countryCode === "PH" || last.countryCode === "PH";
  const options = philippinesPair
    ? [airlineOption("philippine_airlines", "philippine_airlines", distanceMeters), airlineOption("cebu_pacific", "cebu_pacific", distanceMeters)]
    : [airlineOption("generic_air", "generic_air", distanceMeters)];
  options.forEach((option) => { option.legs = [{
    mode: "flight",
    title: "Geographic air corridor",
    distanceMeters,
    durationSeconds: airRoute.durationSeconds,
    geometry: airRoute.geometry,
    steps: [],
    source: "Wandr great-circle preview",
  }]; });
  return { airports: { origin: first, destination: last }, airRoute, options, warning: null };
}
