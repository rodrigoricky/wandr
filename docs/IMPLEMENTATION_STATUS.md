# Implementation status

## Repository audit and work state (2026-11-08)

- Audited the existing Wandr repository, dependencies, source, tests, Worker/Pages configuration, and authenticated Cloudflare account before changing code. Initial branch `main` matched `origin/main` at `4d520936fb96a561a570451fab4b87b1c6c82148`; implementation is isolated on `codex/wandr-full-correction-20261108`.
- Starting checks: `npm ci`, `npm run check`, `npm run test:e2e`, `npm audit`, and Worker dry-run passed. Baseline defects and missing external resources are recorded in [TEST_REPORT.md](./TEST_REPORT.md).
- Geoapify route geometry normalization is committed in `bce3022`. Subsequent search/coverage, comparison eligibility, map, interface, and documentation changes are recorded in later commits on this same safe branch.
- Cloudflare authentication works, but no `wandr` Pages project, `wandr-api-preview` or `wandr-api-production` Worker, target DNS records, or Geoapify secret was found. Do not modify unrelated sites or DNS. No staging or production deployment has occurred.

## Phase gates

| Phase | Status | Completed | Remaining gate |
|---|---|---|---|
| 1. Providers, GPS, and map routes | **PARTIAL — live provider gate blocked** | GeoJSON LineString/MultiLineString validation, multi-leg preservation, ordered provider instructions, metric normalization, timeout/quota/configuration errors, abort propagation, and GPS race handling. Parser fixtures and local UI paths are tested. | Supply/configure a Geoapify key, then verify real Davao walking/driving provider geometry and route rendering end-to-end. GPS grant and timeout still need device/provider verification. |
| 2. Worldwide establishment search | **PARTIAL — live provider gate blocked** | Removed Davao query filtering; optional map bias only. Search retains place name, secondary address, category, source, confidence, and coordinates. Global scope handling returns an explicit unsupported journey outside the current approximate Davao rectangle. | Real Davao and overseas searches, local POI categories, ambiguity handling, and independent coordinate checks require a Geoapify key. |
| 3. Grayscale map-first experience | **PARTIAL — fixture/browser checks pass** | One persistent MapLibre map under search/results/details; grayscale sheets; worldwide named suggestions; opt-in GPS; cancelable search; route details; Back state; exact 13 requested viewport sizes including short landscape in Playwright. Attribution remains in the map. Final local screenshots are captured at `/tmp/wandr-search-390.png` and `/tmp/wandr-results-390.png`. | Geoapify-backed selections/routes and physical iOS/Android touch, GPS, and keyboard checks remain unverified. |
| 4. Verified Davao passenger journeys and fares | **BLOCKED** | No fabricated local option or fare is presented. Road driving is an unranked baseline; only short routed walking can be ranked. Current Davao project and fare-source gaps are recorded in [DATA_SOURCES.md](./DATA_SOURCES.md). | Need current traceable stop/route/direction data and applicable current LTFRB fare sources supporting at least two repeatable Davao passenger journeys. |
| 5. Staging, production, and handoff | **BLOCKED before stage** | Static Pages + separate Workers architecture retained; production static builds now require an explicit target HTTPS API URL; updated README, architecture, sources, status, and test reports. Local checks and Worker dry-run pass. | No Geoapify key, Wandr Cloudflare resources, preview origin, or target DNS records. Real-provider staging gate must pass before any production promotion. |

## Implementation notes

- Search and comparison coverage are separate: worldwide lookup does not imply global transportation coverage.
- `compare` returns no public-transit, taxi, tricycle, or ride-hailing claim. Long or slow walks above the 1.5 km / 25 minute design limit are excluded from standard comparison. Driving routes have unknown fares and cannot win the fastest passenger-journey sort.
- Static production build rejects a missing `NEXT_PUBLIC_API_BASE_URL`; the local static-build check explicitly supplies a local Worker URL. No provider secret is exposed to the browser.
- No complete MVP, real provider integration, or deployment is claimed. See the acceptance evidence matrix in [TEST_REPORT.md](./TEST_REPORT.md).
