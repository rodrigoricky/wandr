# Test and acceptance report

Last checked: 2026-11-08. This report separates deterministic tests from live Geoapify/map checks and deployment observations. Browser fixtures are not counted as provider integration passes.

## Repository baseline

- Starting branch `main` matched `origin/main` at `4d520936fb96a561a570451fab4b87b1c6c82148`. Work was performed on `codex/wandr-full-correction-20261108`; the unrelated root `a.md` remains untracked and untouched.
- Production map screenshot: `/tmp/wandr-production-map-mobile.png`. Automated screenshots: `/tmp/wandr-map-320.png`, `/tmp/wandr-map-375.png`, `/tmp/wandr-map-390.png`, `/tmp/wandr-map-430.png`, `/tmp/wandr-map-1280.png`, and `/tmp/wandr-map-fallback-390.png`. The primary and fallback screenshots use live public map resources.
- `npm ci`: PASS during initial audit; package manifests and lockfile were unchanged by this correction.

## Latest verification

- `npm run check`: PASS after implementation (strict TypeScript in all workspaces, ESLint, 31 unit tests, local static Next export).
- `npm run test:e2e`: PASS, 9 browser tests. This includes live map vector-tile responses and nonuniform WebGL pixels, responsive resizing, nonfatal sprite failure, simulated primary style outage followed by actual OSM PNG tiles and online recovery, actual WebGL context loss/restoration, single map instance after reload, search/selection/sort/details/back, Davao alias merge, global unsupported scope and opt-in GPS denial. Widths 320, 375, 390, 430 and 1280 were checked in the map test; the trip-flow suite additionally checks 360, 414, 600, 768, 1024, 1440, 844×390 and 932×430.
- `NEXT_PUBLIC_API_BASE_URL=https://wandr-api-preview.rickyrodrigo-ph.workers.dev npm run build:web`: PASS. Preview static export was deployed to Cloudflare Pages branch `codex-wandr-full-correction`; its current deployment alias is `https://codex-wandr-full-correction-oiad.wandr-ld1.pages.dev`.
- `npm audit`: PASS, zero known vulnerabilities.
- `npm run deploy:dry-run -w @wandr/api`: PASS (Wrangler 4.158.0; 26.87 KiB upload, 7.46 KiB gzip; production rate-limit binding present). The dry run itself did not deploy.
- `npm run build:web` with no API URL: EXPECTED BLOCK (exit 1). The production static-build gate prevents output without a valid HTTPS Worker URL. `npm run build:web:local` explicitly supplies the local Worker URL for local build checks.
- `git diff --check`: PASS.
- Local Worker HTTP smoke: health returned `configured.geoapify=false` and `providersProbed=false`; global place search returned `503 CONFIGURATION_MISSING`; a cross-region Eiffel Tower→Tokyo Tower compare returned `scope: unsupported`, no route options, and no route-provider request; CORS granted `http://localhost:3000` and withheld `Access-Control-Allow-Origin` from `https://untrusted.example`.
- `git diff --check`: PASS. The API key is kept in Cloudflare Worker secrets; secret scan and final post-deployment check must still be recorded.
- Local browser map: OpenFreeMap Positron tiles render with OpenStreetMap/OpenFreeMap and Geoapify attribution. Most Playwright trip-flow tests intercept API responses; the map resilience tests use actual OpenFreeMap/OSM resources. Provider integration is recorded separately below.

## External provider and deployment checks

- The Geoapify key is configured only as preview/production Worker secrets. It was not emitted to the client bundle, tracked source, or build environment. A final automated scan is pending.
- Live provider searches returned Davao mall, college, university, hospital, airport and City Hall results and Paris, Tokyo and Sydney landmarks. Preview's current Worker returned Francisco Bangoy International Airport as the top exact-name match (HTTP 200; 1.005 s in this single request). The production search benchmark performed before this change had p50 1.308 s and p95 4.559 s across ten serial requests, with one slow college result; this is a small sample, not a service-level guarantee. Name-first ranking addresses the inspected weak global match ordering but does not guarantee authoritative POI identity or complete disambiguation.
- Preview: `https://codex-wandr-full-correction-oiad.wandr-ld1.pages.dev`; API: `https://wandr-api-preview.rickyrodrigo-ph.workers.dev`; preview Worker version `16034516-dfc6-4beb-8b9c-b1ba0107a90f`; Pages deployment `8303c8c7-70e6-49bb-a8be-78504e48098f`. A browser-selected Davao origin/destination completed a real HTTPS `POST /v1/trips/compare` (HTTP 200, exact CORS origin), drew the map, and displayed the driving road-time baseline as an unverified vehicle journey with no fare. Preview health reports configured provider secret. Untrusted-origin preflight omitted `Access-Control-Allow-Origin`.
- The production map browser audit returned HTTP 200 for its current style, style metadata, sprites, glyphs, sampled vector tiles and MapLibre worker, rendered nonuniform WebGL pixels, and had no console errors/page errors. The historical failure was not reproduced, so no failed production resource URL/status can be asserted. The discovered error-state lifecycle flaw is regression-tested with simulated recoverable sprite and fatal-style failures.
- Production before promotion: `https://wandr.ricky.network`; API `https://api.wandr.ricky.network`. Production preview deployment and Worker details must be replaced below after main is fast-forwarded and production is redeployed and retested.
- Physical iOS/Android touch, GPS grant and timeout were not tested. Phase 4 remains blocked: there is no documented DIBS integration API/data-reuse permission, validated ordered passenger-stop/direction dataset, or applicable current fare matrix supporting two repeatable journeys.

## A01–A40 acceptance matrix

| ID | Status | Evidence / remaining requirement |
|---|---|---|
| A01 | PASS | `npm ci` passed from the lockfile in baseline audit; dependencies were not changed. |
| A02 | PASS | Latest `npm run check` passes typecheck, lint, unit suite, and local static export. |
| A03 | PASS | Geoapify key is Worker-only; production static build refuses missing/non-HTTPS API URL. Static bundle scan found no key assignment or API-key query value; tracked source has only the `.dev.vars.example` placeholder. |
| A04 | PARTIAL | Live provider route returned LineString geometry and rendered in the production browser journey. MultiLineString normalization is fixture-tested; no live MultiLineString response was observed. |
| A05 | PASS | LineString/MultiLineString normalization and malformed/out-of-bounds geometry rejection covered by unit tests. |
| A06 | PASS | Production Geoapify Davao road route was obtained; the walking route exceeded the short-walk limit and was correctly omitted. |
| A07 | PASS | Production HTTPS Pages app and map loaded; map attribution was visible in the browser journey. |
| A08 | PASS | Geoapify, OpenFreeMap, OpenMapTiles, and OpenStreetMap attribution is visible in screenshots and Playwright at the required widths. |
| A09 | PARTIAL | Fixture route screenshot shows A/B markers and matching test geometry; real selected-provider coordinates and route alignment remain unverified. |
| A10 | PASS | Playwright confirms no GPS request on initial load and exactly one after explicit button action. |
| A11 | PARTIAL | Permission denial preserves manual search; physical browser timeout behavior is not verified. |
| A12 | UNVERIFIED | No device-level GPS grant/reverse-geocode test with a live key. |
| A13 | PASS | Production live search returned Davao and Paris-area Geoapify results. |
| A14 | PASS | Production queries returned Davao mall, hospital, school, university, and airport records with real provider coordinates. |
| A15 | PARTIAL | Fixture verifies named result plus secondary address and keyboard selection; same-name ambiguity has no live-provider evidence. |
| A16 | PARTIAL | 280 ms debounce, abort, stale-result clearing, arrow/Enter, and touch selection are implemented; no real-provider race/quota test. |
| A17 | PASS | Unit/API and browser fixture checks preserve global selections and return an honest unsupported response without routing. |
| A18 | PASS | Validation tests cover malformed, out-of-range, incomplete bias, and same-point journeys before provider work. |
| A19 | PASS | Reviewed final grayscale search/results screenshots; no colored accent, visible brand header, or marketing footer. |
| A20 | PASS | Playwright confirms the centered desktop phone frame is capped at 430 px and mobile uses full viewport. |
| A21 | PASS | No horizontal document overflow at all 11 required widths plus two short landscape sizes. |
| A22 | PARTIAL | Keyboard search selection and reduced-motion CSS exist; full focus/Escape/reduced-motion browser matrix not executed. |
| A23 | PARTIAL | Loading/cancel/retry, retained locations, and visible configuration errors are implemented; all provider/offline/timeout states are not end-to-end exercised. |
| A24 | PASS | Result sort is local; test confirms one compare request through sort/details/back; unrankable road time receives no winner. |
| A25 | PARTIAL | Walking total time/distance are provider-derived; drive is explicitly road-time baseline with unknown fare. No verified passenger journey data exists. |
| A26 | BLOCKED | No two source-backed feasible Davao passenger journeys with stop/direction evidence. |
| A27 | BLOCKED | No accepted current source/fare matrix record is wired into the app. |
| A28 | PASS | Unknown drive fare is rendered unavailable and cannot receive a cheapest badge. |
| A29 | PASS | API tests enforce the configured 1.5 km and 25 minute maximum for default walking comparison. |
| A30 | PARTIAL | Real provider step normalization/details are fixture-tested; live route instructions are blocked by missing key. |
| A31 | PASS | Route detail links to Google Maps directions and does not claim booking. |
| A32 | PARTIAL | One map instance, resize observer, and style-load layer restoration are implemented; long repeat-search lifecycle/leak checks are not automated. |
| A33 | PASS | Validation/CORS tests and local HTTP smoke reject invalid inputs and omit CORS permission for an untrusted origin. |
| A34 | PASS | Unit tests cover quota/timeout/abort; Worker rate-limit binding test returns 429. Live upstream quota behavior remains unverified. |
| A35 | BLOCKED | No route/fare records were accepted; source, stop order, and fare-date integrity cannot be evaluated until authorized data is supplied. |
| A36 | PASS | Preview Pages and Worker deployed; exact preview CORS configured; real Geoapify search and Davao browser route passed. |
| A37 | PASS | `wandr.ricky.network` Pages custom domain is active, the CNAME targets the Wandr Pages project, public DNS returns Cloudflare, and HTTPS returns 200. This machine's default resolver retained a negative cache during final checks. |
| A38 | PASS | Production Pages and API Worker deployed; custom domains and exact production CORS are active; real-provider browser search and route passed over HTTPS. |
| A39 | BLOCKED | No production passenger-route/fare comparison; phase 4 source gate is blocked. |
| A40 | UNVERIFIED | No physical Android or iOS browser test. |

## Remaining unresolved inputs

1. Obtain current traceable Davao route/stop/direction records and applicable LTFRB fare documents for two repeatable passenger journeys. Until then, Wandr must remain a walking/road-estimate prototype rather than a public-transit/fare comparison product.
2. Run physical Android/iOS checks for touch, GPS grant, timeout, and keyboard behavior. See [DATA_SOURCES.md](./DATA_SOURCES.md) for the transport-source gap and [README.md](../README.md) for deployment topology.
