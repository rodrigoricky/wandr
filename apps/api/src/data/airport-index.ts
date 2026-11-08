import data from "../../data/airport-index.json";
import type { Airport, Place } from "@wandr/shared";

type AirportRecord = (typeof data.airports)[number];
const airports: Airport[] = (data.airports as AirportRecord[]).map((airport) => ({
  iata: airport.iata,
  name: airport.name,
  coordinates: { lat: airport.lat, lon: airport.lon },
  countryCode: airport.countryCode,
  municipality: airport.municipality,
  type: airport.type === "large_airport" ? "large_airport" : "medium_airport",
  region: airport.region,
}));

export function airportIndexMetadata() {
  return { source: data.source, revision: data.sourceRevision, sha256: data.sourceSha256, count: airports.length };
}

export function distanceBetween(first: { lat: number; lon: number }, second: { lat: number; lon: number }): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const lat1 = radians(first.lat);
  const lat2 = radians(second.lat);
  const dLat = lat2 - lat1;
  const dLon = radians(second.lon - first.lon);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6_371_008.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const countryCodes: Record<string, string> = {
  "united states": "US", "united states of america": "US", "united kingdom": "GB", "great britain": "GB",
  france: "FR", japan: "JP", philippines: "PH", singapore: "SG", australia: "AU", canada: "CA", italy: "IT",
  germany: "DE", spain: "ES", thailand: "TH", indonesia: "ID", "south korea": "KR", korea: "KR", china: "CN",
};

function placeCountryCode(place: Place): string | null {
  const code = place.countryCode?.trim().toUpperCase();
  if (code && /^[A-Z]{2}$/.test(code)) return code;
  const country = place.country?.trim().toLocaleLowerCase();
  return country ? countryCodes[country] ?? null : null;
}

/** Pick only a served, IATA-coded airport in the place's country and within the 250 km catchment. */
export function resolveAirport(place: Place): Airport | null {
  const code = placeCountryCode(place);
  if (!code) return null;
  const candidates = airports.flatMap((airport) => {
    if (airport.countryCode !== code) return [];
    const distanceMeters = distanceBetween(place.coordinates, airport.coordinates);
    if (distanceMeters > 250_000) return [];
    // Prefer a major served airport when similarly close; never let size replace country/proximity checks.
    const sizePenalty = airport.type === "large_airport" ? 0 : 25_000;
    const municipalityMatch = place.city && airport.municipality
      && place.city.toLocaleLowerCase().includes(airport.municipality.toLocaleLowerCase()) ? -15_000 : 0;
    return [{ airport, score: distanceMeters + sizePenalty + municipalityMatch, distanceMeters }];
  });
  candidates.sort((a, b) => a.score - b.score || a.distanceMeters - b.distanceMeters || a.airport.iata.localeCompare(b.airport.iata));
  return candidates[0]?.airport ?? null;
}
