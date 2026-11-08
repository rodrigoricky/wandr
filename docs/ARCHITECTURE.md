# Architecture

Wandr is a small npm-workspaces repository: `apps/web` is a Next.js App Router client exported as static files, `apps/api` is a separate Cloudflare Worker, and `packages/shared` contains API contracts and coordinate/geometry helpers. There are no accounts, database, booking, payment, or trip-history features.

## Request flow

1. The browser requests autocomplete suggestions from the Worker. It displays the provider's named place first and address/category as secondary context. A map-position bias is optional and never excludes global results.
2. The user may explicitly request GPS. The browser sends coordinates to reverse geocoding; if the provider cannot name the location, the coordinate fallback is retained.
3. The Worker validates place coordinates independently of their labels. Worldwide place lookup is allowed; the current transport coverage check is a broad approximate Davao coordinate rectangle, not an authoritative city boundary.
4. Outside that rectangle, compare returns an unsupported-scope response and makes no route-provider request. Inside it, the Worker requests walking and driving routes concurrently from Geoapify.
5. Provider GeoJSON LineString/MultiLineString geometry and ordered legs/steps are validated and normalized. The persistent MapLibre map draws only returned geometry. Malformed or unavailable paths are rejected or reported as partial data.
6. The UI ranks a short walk by price only while its routed length is at most 1.5 km and time at most 25 minutes. A driving-road estimate has unknown fare and is never ranked as a complete fastest passenger journey. No jeepney, bus, taxi, tricycle, or ride-hailing service is asserted without supported routes, availability, and applicable fare evidence.

## Interface states

One map instance remains mounted under the search, results, and route-detail bottom sheets. Search keeps origin/destination, swap, opt-in GPS, loading cancellation, and the location picker. Results switch locally between “Save money” and “Get there faster”; unknown fares and incomplete road-time baselines cannot receive a winner badge. Details show provider-returned route steps, source context, and an external directions link. History-backed Back behavior restores previous result/detail state. A map tile failure leaves search and API flows available.

## Security and deployment

The Worker owns Geoapify requests and `GEOAPIFY_API_KEY`; no provider key is part of the static client. Worker CORS uses an exact configured-origin allowlist and the public search/compare paths use the configured Cloudflare rate-limit binding. Health reports secret configuration without probing upstream providers. CORS is not authentication.

The intended deployment is Cloudflare Pages serving `apps/web/out` and distinct preview/production Cloudflare Workers. Pages builds must receive the matching `NEXT_PUBLIC_API_BASE_URL`; Worker origins and CORS must match each environment. At the audit point, Cloudflare authentication was available, but Wandr resources, target DNS records, authorized preview origin, and provider secret were not. No deployment has been made.
