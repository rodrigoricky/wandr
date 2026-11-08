# Test and acceptance report

Last checked: 2026-11-08. This report distinguishes local code/fixture tests from provider-backed and deployed behavior. Fixture passes are not counted as live integration passes.

## Repository baseline

- Starting branch `main` matched `origin/main` at `4d520936fb96a561a570451fab4b87b1c6c82148`; dependency install and baseline checks passed before changes.
- Baseline screenshot: `/tmp/wandr-baseline.png`. Final UI screenshots: `/tmp/wandr-search-390.png` and `/tmp/wandr-results-390.png`. The final screenshots use a real OpenFreeMap/OSM basemap and test-only intercepted route/search responses.
- `npm ci`: PASS at audit baseline; no dependency/lockfile changes were made in this implementation.

## Latest verification

- `npm run check`: PASS (strict TypeScript in all workspaces, ESLint, 28 unit tests, local static Next export).
- `npm run test:e2e`: PASS (4 Playwright journeys, including map readiness, search/select/swap, results/details/back, unsupported global journey, opt-in GPS denial, attribution, and no horizontal overflow at 320, 360, 375, 390, 414, 430, 600, 768, 1024, 1280, 1440, 844×390, and 932×430).
- `NEXT_PUBLIC_API_BASE_URL=https://api.wandr.ricky.network npm run build:web`: PASS as a configured production static export. This only verifies build-time URL wiring; it does not resolve DNS, contact the host, or deploy. Missing and plain-HTTP URLs both fail the production build gate as expected.
- `npm audit`: PASS, zero known vulnerabilities.
- `npm run deploy:dry-run -w @wandr/api`: PASS (Wrangler 4.158.0; 22.48 KiB upload, 6.46 KiB gzip; production rate-limit binding present). This did not deploy anything.
- `npm run build:web` with no API URL: EXPECTED BLOCK (exit 1). The production static-build gate prevents output without a valid HTTPS Worker URL. `npm run build:web:local` explicitly supplies the local Worker URL for local build checks.
- `git diff --check`: PASS.
- Local Worker HTTP smoke: health returned `configured.geoapify=false` and `providersProbed=false`; global place search returned `503 CONFIGURATION_MISSING`; a cross-region Eiffel Tower→Tokyo Tower compare returned `scope: unsupported`, no route options, and no route-provider request; CORS granted `http://localhost:3000` and withheld `Access-Control-Allow-Origin` from `https://untrusted.example`.
- Local browser map: OpenFreeMap Positron tiles rendered with OpenStreetMap/OpenFreeMap and Geoapify attribution. Playwright intercepts place/compare APIs for deterministic journeys; it did not make real Geoapify calls.

## External provider and deployment checks

- `GEOAPIFY_API_KEY` is absent from the environment and `apps/api/.dev.vars` is absent. No live local or overseas Geoapify search, route, reverse-geocode, or key-backed staging check could run. The local Worker correctly returned its missing-configuration error.
- Cloudflare Pages account listing contains no `wandr` project. Requests for `wandr-api-preview` and `wandr-api-production` returned Cloudflare error 10007 (“Worker does not exist”). DNS lookups for `wandr.ricky.network` and `api.wandr.ricky.network` returned no records. Existing unrelated projects/domains were left unchanged.
- No staging or production deployment, custom-domain/TLS verification, live provider E2E, or physical iOS/Android test was performed. Production promotion is not safe until the real-provider staging gate and transport-data gates pass.

## A01–A40 acceptance matrix

| ID | Status | Evidence / remaining requirement |
|---|---|---|
| A01 | PASS | `npm ci` passed from the lockfile in baseline audit; dependencies were not changed. |
| A02 | PASS | Latest `npm run check` passes typecheck, lint, unit suite, and local static export. |
| A03 | PASS | Geoapify key is Worker-only; production static build refuses missing/non-HTTPS API URL. Static bundle scan found no key assignment or API-key query value; tracked source has only the `.dev.vars.example` placeholder. |
| A04 | BLOCKED | Parser handles documented GeoJSON geometry via fixtures; real Geoapify MultiLineString response and visual route draw need key-backed run. |
| A05 | PASS | LineString/MultiLineString normalization and malformed/out-of-bounds geometry rejection covered by unit tests. |
| A06 | BLOCKED | No real Geoapify Davao route was obtained. |
| A07 | BLOCKED | Local map style/worker loads, but there is no Pages preview or production deployment to check. |
| A08 | PASS | Geoapify, OpenFreeMap, OpenMapTiles, and OpenStreetMap attribution is visible in screenshots and Playwright at the required widths. |
| A09 | PARTIAL | Fixture route screenshot shows A/B markers and matching test geometry; real selected-provider coordinates and route alignment remain unverified. |
| A10 | PASS | Playwright confirms no GPS request on initial load and exactly one after explicit button action. |
| A11 | PARTIAL | Permission denial preserves manual search; physical browser timeout behavior is not verified. |
| A12 | UNVERIFIED | No device-level GPS grant/reverse-geocode test with a live key. |
| A13 | BLOCKED | Overseas POI selection is fixture-tested; live local and overseas provider queries need a key. |
| A14 | BLOCKED | No live mall, school, university, hospital, and airport result/coordinate check. |
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
| A36 | BLOCKED | No preview Worker, Pages preview, authorized preview origin, or real provider secret. |
| A37 | BLOCKED | `wandr.ricky.network` has no DNS record and no Pages custom-domain deployment. |
| A38 | BLOCKED | No production host or provider-backed search/route flow. |
| A39 | BLOCKED | No production passenger-route/fare comparison; phase 4 source gate is blocked. |
| A40 | UNVERIFIED | No physical Android or iOS browser test. |

## Remaining owner-side inputs

1. Configure a Geoapify key as a Worker secret for a named preview environment; do not send it in chat or commit it.
2. Provide/authorize current traceable Davao route/stop/direction records and effective LTFRB fare documents, or accept that transportation comparison remains out of scope/blocked.
3. Create or authorize the Wandr preview Pages/Worker resources and target domain/DNS configuration; do not reuse or change unrelated Cloudflare projects.
4. Run real-provider preview flows and physical mobile checks before production. See [DATA_SOURCES.md](./DATA_SOURCES.md) for source gaps and [README.md](../README.md) for deployment topology.
