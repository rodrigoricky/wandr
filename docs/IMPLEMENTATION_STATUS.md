# Implementation status

## Audit and delivery

The repository was inspected before edits: workspace source, dependencies/lockfile, tests, static-export configuration, Cloudflare Workers/Pages configuration, current branch/remotes, and live production endpoints. The original `main`/`origin/main` was `4d520936fb96a561a570451fab4b87b1c6c82148`; implementation and verification took place on `codex/wandr-full-correction-20261108`, whose parent history included the earlier route-normalization correction. The unrelated untracked root file `a.md` was preserved and excluded from deployment changes.

The production basemap failure was not reproducible during the live browser audit: OpenFreeMap style, metadata, sprites, glyphs, vector tiles and the self-hosted MapLibre worker returned successful responses, and WebGL drew the Davao map. The code audit did expose a lifecycle defect: every early MapLibre `error` (including recoverable sprite/glyph errors) immediately set the permanent map-error state. The map now waits for a first complete render, falls back to direct OpenStreetMap raster tiles after a confirmed primary-style startup failure, shows the required fallback attribution, recovers to OpenFreeMap on reconnect, and reports WebGL context loss/restoration. Browser checks cover primary pixels, sprite failures, real fallback tile responses, reconnect, context recovery and map reinitialization.

Place search received name-first provider ranking, a bounded 60-second query/bias cache, a shorter debounce with stale-result protection, and seven reviewed local Davao aliases. These records are provider-sourced landmark names and coordinates, not an inferred transit network. Results and journey detail were simplified to keep a road estimate visibly separate from an actual passenger option; fare and complete passenger-time comparisons remain unavailable when no sourced option is eligible.

## Phase gates

| Phase | Status | Evidence and remaining gate |
|---|---|---|
| 1. Providers, GPS and map routes | **PARTIAL** | Provider route normalization/validation and prior live Davao route checks pass. Map behavior now has browser coverage for live resources and recovery. No physical GPS grant/timeout test or live MultiLineString response was observed. |
| 2. Worldwide place search | **PASS for provider-backed lookup; PARTIAL for ranking** | Live Davao, Paris, Tokyo and Sydney searches worked. Name-first scoring, alias merging, duplicate suppression and browser query caching are covered locally. Search remains a place lookup, not proof of transport coverage. Same-name ambiguity and independent coordinate adjudication are not complete. |
| 3. Grayscale map-first interface | **PASS for automated viewport/browser checks; PARTIAL for devices** | Search, result, detail and unsupported-scope journeys, map attribution/fallback, keyboard search, touch-sized controls and 13 viewport sizes passed browser checks. Physical iOS/Android and device GPS checks remain unperformed. |
| 4. Verified Davao passenger journeys and fares | **BLOCKED by source authorization/data** | No passenger option or fare is fabricated. The City operates a public DC Bus tracker, but no documented integration API/data-reuse permission or validated stop directions was found. Current official fare files were not matched to the specific Davao journeys. At least two repeatable, source-backed passenger journeys and applicable fare rules are still required. |
| 5. Preview and production deployment | **PREVIEW VERIFIED; PRODUCTION PROMOTION PENDING** | Preview Worker and Pages deployment were updated and a real Geoapify Davao place-selection/comparison browser journey passed over HTTPS after fixing the preview hostname in exact-origin CORS. Production remains on its previously live build until the verified commit is fast-forwarded to `main`, production is deployed from `main`, and its live checks pass. |

## Supported behavior and limits

- Place lookup is worldwide; the transport-coverage check remains an approximate Davao coordinate rectangle, not a city boundary.
- Only a provider-routed short walk within 1.5 km and 25 minutes can qualify as an actual comparison option. A Geoapify driving route is labeled as a road-time baseline, has unknown fare/service availability, and cannot win fastest/cheapest passenger ranking.
- The app does not claim a bus, jeepney, taxi, tricycle, ride-hail, flight or booking service. Unknown fares are unavailable, not estimated.
- The Geoapify credential is kept in the preview/production Worker secret stores; no client bundle, static-build input, tracked source or committed environment file contains it.
- Production rollout must be made from the verified commit on `main` without rewriting remote history. The preview remains available for review.

See [the evidence-based test report](./TEST_REPORT.md) and [the data-source limits](./DATA_SOURCES.md).
