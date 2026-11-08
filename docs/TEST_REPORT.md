# Test report

This report is updated after local verification. A successful compile is not evidence of live provider or deployed service correctness.

## Status

## Execution checkpoints

### Checkpoint 0 — fresh audit (2026-11-08)

- `git status --short --branch`, remote refs and Pages/Worker resource listing were checked before source edits. Starting commit was `4d520936fb96a561a570451fab4b87b1c6c82148`; it matched `origin/main`. Work continues on `codex/wandr-full-correction-20261108`.
- `npm ci`: PASS; 235 packages audited, 0 findings. Baseline `npm run check`: PASS (17 unit tests); `npm run test:e2e`: PASS (3 mocked Chromium journeys); `npm audit`: PASS; Worker dry-run: PASS. Baseline screenshot saved to `/tmp/wandr-baseline.png`.
- Local Worker smoke: health 200 / configured false; place search 503 `CONFIGURATION_MISSING`; reverse lookup 200 coordinate fallback; unauthorized-origin CORS preflight omitted allow-origin. This confirmed no mocked success response.
- No `GEOAPIFY_API_KEY` in process environment and no `apps/api/.dev.vars`; both `wandr-api-preview` and `wandr-api-production` returned Cloudflare “Worker does not exist”; Pages list contained no `wandr` project. DNS lookup for `wandr.ricky.network` and `api.wandr.ricky.network` returned no records. Cloudflare account auth is available but no target resources are configured.

### Checkpoint 1 — routing/map parser repair

- `npm run check`: PASS after repair (21 unit tests: 3 shared, 16 API, 2 web; strict workspace typecheck, lint, Next static build). `npm run test:e2e`: PASS (3/3 fixture-driven browser tests).
- New provider fixture at `apps/api/tests/fixtures/geoapify-routing-multileg.json` follows the documented GeoJSON `MultiLineString` + `properties.legs[].steps` shape. Tests verify ordered per-leg geometry, `instruction.text`, meter/time fields, miles conversion, coordinate bounds, malformed geometry, missing credentials, quota, timeout and abort mapping. This is a documented-shape fixture, not a live Geoapify response.
- Live Davao walking/driving request and live route rendering: **BLOCKED** — Geoapify key is not configured. Do not count fixture coverage as A04/A06 or a completed Phase 1 gate.

- Provider credentials: not configured in the project environment at audit; live Geoapify calls and route visual checks are blocked until an owner supplies a key. The local Worker returned the documented `CONFIGURATION_MISSING` error; coordinate-only reverse-geocode fallback returned HTTP 200.
- Verified transit/fare dataset: absent; transit feasibility and motorized fare accuracy cannot pass acceptance.
- Cloudflare access/deployment: not configured or verified.
- `npm run typecheck`: PASS (shared, API, and web TypeScript).
- `npm run lint`: PASS (all three workspaces, including the browser specs).
- `npm test`: PASS, 17 unit tests across shared/API/web.
- `npm run test:e2e`: PASS, 3 Playwright tests. The search/results/details journey, keyboard place selection, swap, local sort, unknown-fare display, back navigation, GPS denial/opt-in, and viewport widths 320, 360, 375, 390, 430, 600, 768, and 1280px passed. These tests use deterministic fixtures intercepted inside Playwright; they do not claim live provider results.
- `npm run build:web`: PASS; Next.js generated static `apps/web/out` output.
- `npm run deploy:dry-run -w @wandr/api`: PASS; Wrangler 4.158.0 reports 14.22 KiB upload / 4.50 KiB gzip and includes the production rate-limit binding; it exits without deploying.
- `npm audit`: PASS, 0 vulnerabilities after pinning the patched `minimatch` 11.0.5 toolchain dependency. `npm ci` completed from the lockfile.
- Local HTTP smoke: `/v1/health` reports no Geoapify secret and `providersProbed:false`; place search and compare return `CONFIGURATION_MISSING`; reverse geocoding returns a coordinate-only fallback; CORS preflight returns 204; an invalid origin is not granted CORS access. OpenFreeMap Positron style URL returned HTTP 200. Wrangler `dev` logged a timeout fetching the optional `Request.cf` object, fell back to its placeholder, then started and served the tested endpoints.
- Browser: local UI opened; live map rendered after copying MapLibre's bundled worker to the static public path; MapLibre/OpenFreeMap/OpenStreetMap attribution was visible. Live place search returned its expected missing-key error, and GPS returned the coordinate-fallback state. The automated browser flow passed against test-only fixtures. Actual Geoapify-backed browser results, mobile Safari/Chrome, GPS grant/timeout on physical devices, and field routes remain unverified.
- Static bundle scan: all 33 files in `apps/web/out` were checked; no recognizable Geoapify secret token was present.

## Acceptance status

| Requirement | Status | Evidence / blocker |
|---|---|---|
| UI on mobile/desktop sizes | PASS | Playwright Chromium checked 320, 360, 375, 390, 430, 600, 768, and 1280px; no horizontal overflow, desktop frame capped at 430px. Native phone checks remain untested. |
| Opt-in GPS and manual entry | PARTIAL | Playwright proved no GPS request on load, one request after the user action, permission-denied recovery, and manual picker selection using a test fixture. Successful live provider selection and real-device grant/timeout paths remain blocked/unverified. |
| Actual search suggestions | BLOCKED | Geoapify credential absent; Worker reports `CONFIGURATION_MISSING`. |
| Map and route geometry | PARTIAL | OpenFreeMap style rendered with attribution; provider route geometry not available without key. Unit tests verify GeoJSON coordinate order; visual route-line rendering remains unverified. |
| Local transit feasibility | BLOCKED | No verified route/stop dataset. No transit option emitted. |
| Fare comparison accuracy | PARTIAL | Unknown fares stay unknown and are excluded from cheapest ranking; no motorized fare source exists. Walking is shown at ₱0. |
| Search → results → details | PARTIAL | Playwright journey and comparison/detail flow pass with test-only intercepted API data. A real-provider end-to-end journey is blocked by absent Geoapify credentials. |
| Secure Worker | PARTIAL | Server-only provider key, input validation, exact-origin CORS, timeouts, and configured Cloudflare rate-limit binding implemented; deployed configuration not verified. |
| Static Pages build | PASS | Successful export to `apps/web/out`. |
| Cloudflare preview/production | BLOCKED | No Cloudflare account/Pages URL/Worker URL supplied or connected; dry-run only. |
