# Architecture

Wandr is a small npm-workspaces application: a static Next.js client in `apps/web`, a Cloudflare Worker API in `apps/api`, and shared TypeScript contracts and deterministic pricing/classification helpers in `packages/shared`. It has no accounts, saved trip history, booking, payment, live fare quote, airline schedule, or transit-stop database.

## Request flow

1. The browser provides the reviewed Davao aliases immediately and queries Geoapify for worldwide autocomplete. Results retain the provider's country code, city, coordinates, category, and attribution. Search remains debounced, cancellable, keyboard accessible, and bounded by the existing in-memory query cache.
2. GPS is requested only after the user chooses **Use my location**. Reverse geocoding preserves the existing coordinate fallback if a place label cannot be resolved.
3. The Worker validates selected places and classifies by reliable country metadata first. Two locations in the approximate Davao coverage rectangle form a local comparison; different countries form an international journey; known same-country places outside that local area form a domestic long-distance journey. Missing country metadata outside the local area stays unsupported. The rectangle is only a local-demo boundary and never overrides a cross-country classification.
4. Local comparisons request real Geoapify walk and driving routes in parallel. A mapped walk appears only within the existing 1.5 km and 25 minute default limit. When a valid road route exists, stable local fare/time models calculate taxi, car-ride and motorcycle estimates; a conditional jeepney fare reference is included up to 30 km. The Geoapify road line is a distance reference only for those modeled categories. It does not represent their passenger route, stops, pickup, or service coverage. Provider and model provenance stay in the response.
5. Domestic-long-distance and international comparisons resolve each place to a nearby OurAirports directory record in the same ISO country. The index includes only scheduled-service large/medium airports with a three-letter IATA code and valid coordinates, and ignores airports beyond a 250 km catchment. A sampled great-circle corridor is split at the antimeridian and returned as a separate air geometry. Philippines-related pairs receive PAL/Cebu reference estimates; other pairs receive a generic air estimate. Neither result claims a carrier route, nonstop service, schedule, transfer count, seat, or flight price.
6. The persistent MapLibre map keeps solid road geometry and A/B place markers for local journeys. Air options use a distinct dashed line source/layer, airport-code markers and a small plane symbol. Both sources/layers are installed again after style changes, fallback, and recovery. The existing OpenFreeMap primary style, OSM fallback and visible map attribution remain in place.
7. The existing result cards and two local sort controls remain the only comparison controls. The full card opens the detail sheet. Estimates display `Est.` beside PHP values; source assumptions stay in the expandable detail note. Unknown fare/time data cannot win a badge. Sorting is deterministic and does not make another compare request.

## Estimate boundaries

- Local route geometry, distance, walking time and road-driving time come from live Geoapify responses. The taxi reference uses the reported 2026 regular taxi rate of ₱65 flag-down, ₱13.50/km and ₱2/min; applying that rate to a road-route estimate is still not a metered quote. Car and motorcycle prices, modeled durations, and all air estimates use explicit centralized demonstration assumptions.
- Traditional jeepney estimates use the reported ₱14/first 4 km + ₱2/succeeding kilometre fare rule, with a documented whole-kilometre round-up. Driving distance is only an illustrative input, not a claimed jeepney ridden distance. No stop directions are generated.
- The estimated journey time adds a modelled allowance and is rounded into five-minute bands. It is not a pickup-time or passenger-service guarantee.
- Airport records are a proximity aid, not evidence that a passenger can book a route between the airports. The global and PH carrier amounts are model outputs in PHP, never provider-scraped fares.

## Security and deployment

The Worker owns Geoapify calls and the `GEOAPIFY_API_KEY` secret. The key is not exposed to the static build. CORS uses an exact configured-origin allowlist and public search/compare paths use the configured Cloudflare rate limiter. Health reports secret configuration only; it does not probe Geoapify. The frontend remains a static export built with the selected HTTPS API base URL.
