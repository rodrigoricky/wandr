import type { PlaceSuggestion } from "./contracts";

/** Small opt-in Davao lookup index. Coordinates and names were checked against
 * Geoapify Geocoding API results on 2026-11-08. Geoapify's published service
 * terms permit result storage and redistribution; attribution stays visible in
 * the app. This index supplements, and never replaces, worldwide search.
 */
const checkedAt = "2026-11-08";
const sourceRecord = "Geoapify Geocoding API result";
const sourceUrl = "https://apidocs.geoapify.com/docs/geocoding/";

const landmarks: (PlaceSuggestion & { aliases: string[] })[] = [
  {
    id: "davao-index:abreeza-ayala-mall",
    label: "Abreeza Ayala Mall Davao",
    addressLine: "J. P. Laurel Avenue, Davao City, Davao Region, Philippines",
    category: "commercial.shopping_mall",
    city: "Davao City",
    country: "Philippines",
    source: "Wandr Davao landmark index" as const,
    sourceRecord,
    sourceUrl,
    sourceQuery: "Abreeza Mall Davao",
    checkedAt,
    confidence: null,
    coordinates: { lon: 125.611561, lat: 7.0912032 },
    aliases: ["Abreeza Mall Davao", "Abreeza Mall", "Abreeza"],
  },
  {
    id: "davao-index:sm-city-davao",
    label: "SM City Davao",
    addressLine: "Quimpo Boulevard, Talomo District, Davao City, Davao Region, Philippines",
    category: "commercial.shopping_mall",
    city: "Davao City",
    country: "Philippines",
    source: "Wandr Davao landmark index" as const,
    sourceQuery: "SM City Davao",
    confidence: null,
    coordinates: { lon: 125.5888076, lat: 7.0487529 },
    aliases: ["SM Davao", "SM City Davao Ecoland"],
  },
  {
    id: "davao-index:san-pedro-college",
    label: "San Pedro College",
    addressLine: "12 L. M. Guerrero Street, Davao City, Davao Region, Philippines",
    category: "education.college",
    city: "Davao City",
    country: "Philippines",
    source: "Wandr Davao landmark index" as const,
    sourceQuery: "San Pedro College Davao",
    confidence: null,
    coordinates: { lon: 125.6156195, lat: 7.0779939 },
    aliases: ["San Pedro College Davao", "SPC Davao"],
  },
  {
    id: "davao-index:university-of-mindanao-matina",
    label: "University of Mindanao - Matina Campus",
    addressLine: "South Street, Davao City, Davao Region, Philippines",
    category: "education.university",
    city: "Davao City",
    country: "Philippines",
    source: "Wandr Davao landmark index" as const,
    sourceQuery: "University of Mindanao Matina",
    confidence: null,
    coordinates: { lon: 125.5949266, lat: 7.0671498 },
    aliases: ["University of Mindanao Matina", "UM Matina", "UM Matina Campus"],
  },
  {
    id: "davao-index:davao-doctors-hospital",
    label: "Davao Doctors Hospital",
    addressLine: "118 E. Quirino Avenue, Davao City, Davao Region, Philippines",
    category: "healthcare.hospital",
    city: "Davao City",
    country: "Philippines",
    source: "Wandr Davao landmark index" as const,
    sourceQuery: "Davao Doctors Hospital",
    confidence: null,
    coordinates: { lon: 125.60441, lat: 7.0704387 },
    aliases: ["Davao Doctors", "DDH Davao"],
  },
  {
    id: "davao-index:francisco-bangoy-airport",
    label: "Francisco Bangoy International Airport",
    addressLine: "Carlos P. Garcia Highway, Davao City, Davao Region, Philippines",
    category: "airport",
    city: "Davao City",
    country: "Philippines",
    source: "Wandr Davao landmark index" as const,
    sourceQuery: "Francisco Bangoy International Airport",
    confidence: null,
    coordinates: { lon: 125.6450236, lat: 7.1301521 },
    aliases: ["Davao International Airport", "Francisco Bangoy Airport", "Davao Airport"],
  },
  {
    id: "davao-index:davao-city-hall",
    label: "Davao City Hall",
    addressLine: "City Hall Drive, Davao City, Davao Region, Philippines",
    category: "tourism.sights.city_hall",
    city: "Davao City",
    country: "Philippines",
    source: "Wandr Davao landmark index" as const,
    sourceQuery: "City Hall Davao",
    confidence: null,
    coordinates: { lon: 125.6079614, lat: 7.064662 },
    aliases: ["City Hall Davao", "Davao City Hall"],
  },
].map((place) => ({ ...place, sourceRecord, checkedAt }));

export function normalizePlaceQuery(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function relevance(query: string, candidate: string): number {
  const normalized = normalizePlaceQuery(candidate);
  if (normalized === query) return 400;
  if (normalized.startsWith(query)) return 300;
  if (normalized.split(" ").some((token) => token.startsWith(query))) return 200;
  const tokens = query.split(" ");
  if (tokens.length > 1 && tokens.every((token) => normalized.split(" ").some((part) => part.startsWith(token)))) return 100;
  return 0;
}

export function findDavaoLandmarks(queryText: string): PlaceSuggestion[] {
  const query = normalizePlaceQuery(queryText);
  if (query.length < 2) return [];
  if (query === "city hall") return [];
  return landmarks
    .map((place) => ({ place, score: Math.max(relevance(query, place.label), ...place.aliases.map((alias) => relevance(query, alias))) }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.place.label.localeCompare(b.place.label))
    .slice(0, 6)
    .map(({ place }) => place);
}

export const davaoLandmarkIndexMetadata = { source: sourceRecord, checkedAt, count: landmarks.length } as const;
