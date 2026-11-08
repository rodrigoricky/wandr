# Architecture

Wandr is a small npm-workspaces repository: `apps/web` is a Next.js App Router client exported as static files, `apps/api` is a Cloudflare Worker, and `packages/shared` contains contracts, geographic helpers, and a small reviewed Davao landmark index. No accounts, bookings, payments, or saved trip history are implemented.

## Request flow

1. The browser serves a seven-place Davao name/alias index immediately while a worldwide Geoapify autocomplete request runs. Provider results are merged and deduplicated by canonical name and nearby coordinates. A bounded in-memory browser cache retains normalized queries for 60 seconds; the input debounce is 180 ms, requests are cancellable, and stale-query results are disabled until the active query resolves.
2. The user may explicitly request GPS. The browser sends coordinates to reverse geocoding; if the provider cannot name the location, the coordinate fallback is retained.
3. The Worker validates place coordinates independently of their labels. Worldwide place lookup is allowed; the current transport coverage check is a broad approximate Davao coordinate rectangle, not an authoritative city boundary.
4. Outside that rectangle, compare returns an unsupported-scope response and makes no route-provider request. Inside it, the Worker requests walking and road routes concurrently from Geoapify.
5. Provider GeoJSON LineString/MultiLineString geometry and ordered legs/steps are validated and normalized. The persistent MapLibre map draws returned geometry with longitude-latitude coordinate order, A/B markers, and camera padding above the bottom sheet; it clears the one-point camera padding before fitting both points so the values cannot accumulate. Map error events are treated as resource errors until a complete render fails; after a confirmed initial resource failure, the map falls back to OpenStreetMap raster tiles and retries OpenFreeMap when the browser reports that it is online again.
6. The UI ranks a short walk by price only while its routed length is at most 1.5 km and time at most 25 minutes. A road driving duration remains an unranked road-time baseline. No jeepney, city bus, taxi, tricycle, or ride-hailing availability, fare, or complete passenger time is claimed without a permitted source and validated routes.

## Interface states

One map instance remains mounted under search and result sheets. The result card is the accessible selection control; the selected journey sheet shows the mapped origin-to-destination path, time/fare limits, and an expandable source note. It does not present generic road turn instructions or a redundant “View route” button. Results switch locally between “Save money” and “Get there faster.” Unknown fares and incomplete road times cannot receive a winner marker. Browser Back restores prior results/detail state.

## Security and deployment

The Worker owns Geoapify requests and `GEOAPIFY_API_KEY`; no provider key is part of the static client. Worker CORS uses an exact configured-origin allowlist and public search/compare paths use the configured Cloudflare rate-limit binding. Health reports secret configuration without probing upstream providers. CORS is not authentication.

The deployment is Cloudflare Pages serving `apps/web/out` and distinct preview/production Cloudflare Workers. Pages builds must receive the matching `NEXT_PUBLIC_API_BASE_URL`; Worker origins and CORS must match each environment. The primary map uses OpenFreeMap Positron; the fallback uses the OpenStreetMap Foundation's standard raster tile service directly from browsers with visible attribution. The OSM tile service is best-effort and its tile usage policy applies; Wandr does not proxy, prefetch, or bulk-download tiles.
