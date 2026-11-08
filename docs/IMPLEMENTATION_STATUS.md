# Implementation status

## Repository audit and work state (2026-11-08)

- Audited the existing Wandr repository, dependencies, source, tests, Worker/Pages configuration, and authenticated Cloudflare account before changing code. Initial branch `main` matched `origin/main` at `4d520936fb96a561a570451fab4b87b1c6c82148`; implementation is isolated on `codex/wandr-full-correction-20261108`.
- Starting checks: `npm ci`, `npm run check`, `npm run test:e2e`, `npm audit`, and Worker dry-run passed. Baseline defects and missing external resources are recorded in [TEST_REPORT.md](./TEST_REPORT.md).
- Geoapify route geometry normalization is committed in `bce3022`. Subsequent search/coverage, comparison eligibility, map, interface, and documentation changes are recorded in later commits on this same safe branch.
- The initial account audit found no Wandr deployment resources. After receiving the Geoapify key and deployment authorization, created a dedicated `wandr` Pages project, `wandr-api-preview`, and `wandr-api-production`; configured the exact preview/production CORS origins and production API custom domain; and deployed both preview and production. The Pages domain and API custom domain are active. The Pages CNAME was added only for `wandr.ricky.network`; unrelated records and projects were left unchanged.

## Phase gates

| Phase | Status | Completed | Remaining gate |
|---|---|---|---|
| 1. Providers, GPS, and map routes | **PARTIAL — live routes pass** | GeoJSON validation, multi-leg preservation, metric normalization, timeout/quota/configuration errors, abort propagation, and GPS race handling pass local tests. Production Geoapify route and route rendering pass a live Davao browser journey. | Physical GPS grant/timeout and live MultiLineString response still need verification. |
| 2. Worldwide establishment search | **PASS — live provider checked** | Production search returned Davao mall, hospital, school, university, airport, and Paris-area results with source coordinates/categories where provided. Global scope handling returns an explicit unsupported journey outside the current approximate Davao rectangle. | Same-name ambiguity and independent coordinate checks remain partially verified. |
| 3. Grayscale map-first experience | **PARTIAL — production browser journey passes** | Production UI loads over HTTPS, shows map attribution, runs live place search, and renders provider-backed Davao road results without browser errors. Existing Playwright coverage checks the exact 13 requested viewport sizes, keyboard selection, back navigation, opt-in GPS denial, and unsupported journeys. | Physical iOS/Android touch, GPS, and keyboard checks remain unverified. |
| 4. Verified Davao passenger journeys and fares | **BLOCKED** | No fabricated local option or fare is presented. Road driving is an unranked baseline; only short routed walking can be ranked. Current Davao project and fare-source gaps are recorded in [DATA_SOURCES.md](./DATA_SOURCES.md). | Need current traceable stop/route/direction data and applicable current LTFRB fare sources supporting at least two repeatable Davao passenger journeys. |
| 5. Staging, production, and handoff | **DEPLOYED — provider checks pass** | Pages preview and production, preview and production API Workers, secret configuration, CORS, custom domains, TLS, live searches/routes, and deployed browser journey verified. | Physical devices and Phase 4 source-backed transit/fare comparison remain unresolved. |

## Implementation notes

- Search and comparison coverage are separate: worldwide lookup does not imply global transportation coverage.
- `compare` returns no public-transit, taxi, tricycle, or ride-hailing claim. Long or slow walks above the 1.5 km / 25 minute design limit are excluded from standard comparison. Driving routes have unknown fares and cannot win the fastest passenger-journey sort.
- Static production build rejects a missing `NEXT_PUBLIC_API_BASE_URL`; the local static-build check explicitly supplies a local Worker URL. No provider secret is exposed to the browser.
- Deployment is complete at https://wandr.ricky.network and https://api.wandr.ricky.network. The complete passenger-transit comparison MVP is not claimed because Phase 4 remains blocked. See the acceptance evidence matrix in [TEST_REPORT.md](./TEST_REPORT.md).
