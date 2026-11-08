# Architecture

Wandr is a single npm-workspaces repository. `apps/web` is a Next.js App Router client UI exported as static files. `apps/api` is a separate Cloudflare Worker and owns Geoapify requests and validation. `packages/shared` contains lightweight API types and coordinate normalization. No accounts, cookies, database, trip history, payment, or booking flow exists.

The browser selects Geoapify place suggestions or asks for device location only after a tap. The Worker validates the selected coordinates and approximate Davao bounds, requests real Geoapify walking and driving paths in parallel, and returns only usable GeoJSON paths. Walking fare is represented as ₱0 because no motorized transport is used. A driving path is labeled as a road estimate with unknown fare and no claim of taxi/provider availability or complete pickup-to-arrival time. No verified local route/fare references currently exist.

MapLibre loads the OpenFreeMap Positron style client-side. The map is independent of geocoding and routing; only API-returned route geometry is drawn. OSM attribution remains enabled. Map failure leaves route text/actions available.

The Davao check is intentionally approximate: the Worker applies a broad coordinate box and requires a Davao place label (GPS can use coordinate fallback within that box). This is a configuration limitation, not an authoritative administrative boundary. A sourced boundary dataset and field/provider checks are needed before treating coverage as exact. Worker place-search and comparison endpoints use a Cloudflare rate-limit binding; health is exempt. CORS is an origin allowlist, not an authentication mechanism.

## Deployment topology

Cloudflare Pages serves `apps/web/out`; the browser calls the separately deployed `apps/api` Worker over HTTPS. Provider credentials are Worker secrets. Pages origins must be explicitly allowlisted with `ALLOWED_ORIGINS`. The Worker health endpoint reports configuration only and does not probe upstream providers. No Cloudflare account, deployed Worker, Pages project, API key, or production origin was found during the baseline audit.
