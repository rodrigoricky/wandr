import type { Place } from "./contracts";

export const adduJacintoDemoStart: Place = {
  id: "geoapify:51bfefdfbc38675f4059ffe89b340d4a1c40f00102f9013d69ba0100000000c0020192031a4174656e656f20646520446176616f20556e6976657273697479e203206f70656e7374726565746d61703a76656e75653a7761792f3238393933383533",
  label: "Ateneo de Davao University — Jacinto/Main Campus",
  addressLine: "Roxas Avenue / E. Jacinto Street, Poblacion District, Davao City, Philippines",
  category: "education.university",
  city: "Davao City",
  country: "Philippines",
  countryCode: "PH",
  source: "Geoapify",
  sourceRecord: "Geoapify autocomplete and reverse-geocoding result for the university on E. Jacinto Street",
  sourceUrl: "https://apidocs.geoapify.com/docs/geocoding/",
  sourceQuery: "Ateneo de Davao University Jacinto Main Campus",
  checkedAt: "2026-11-08",
  confidence: 0.5714285714285714,
  coordinates: { lat: 7.072316, lon: 125.612838 },
};

export const adduJacintoDemoStartSource = {
  officialAddress: "Roxas Avenue / E. Jacinto Street, Poblacion District, Davao City, 8000 Davao del Sur, Philippines",
  officialSourceUrl: "https://www.addu.edu.ph/contact-us/",
  geoapifyPlaceId: "51bfefdfbc38675f4059ffe89b340d4a1c40f00102f9013d69ba0100000000c0020192031a4174656e656f20646520446176616f20556e6976657273697479e203206f70656e7374726565746d61703a76656e75653a7761792f3238393933383533",
  geoapifySearchQuery: "Ateneo de Davao University Jacinto Main Campus",
  geoapifyReverseLabel: "Ateneo de Davao University, E. Jacinto Street, Davao City, 8016 DR, Philippines",
  coordinates: { lat: 7.072316, lon: 125.612838 },
  checkedAt: "2026-11-08",
} as const;
