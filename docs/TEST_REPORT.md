# Test and acceptance report

Updated 2026-11-08. This report distinguishes deterministic tests, live-provider checks, browser checks, and deployment evidence. Fixture responses are not counted as provider integration passes.

## Code and deployment identity

- The audited starting point was `main` / `origin/main` at `58609b1` (`docs: clarify deployment evidence locations`). Implementation was committed as `1eb7f94c5970db20baff9d3eb31b5a95e6953c43` and fast-forwarded to and pushed on `main`.
- Preview Pages: [codex-wandr-full-correction-k8pn.wandr-ld1.pages.dev](https://codex-wandr-full-correction-k8pn.wandr-ld1.pages.dev), deployment `c460901a-ceac-46db-a22f-55bac08cfa3f`, branch `codex-wandr-full-correction-oiad`, source `1eb7f94`.
- Preview API: `https://wandr-api-preview.rickyrodrigo-ph.workers.dev`, Worker version `07e3d082-ef0c-4c9c-9979-6f3eaffffb06`.
- Production Pages: [wandr.ricky.network](https://wandr.ricky.network), deployment `aae52918-c498-4a7d-a682-ee8ceb17734e`, branch `main`, source `1eb7f94`.
- Production API: [api.wandr.ricky.network](https://api.wandr.ricky.network/v1/health), Worker version `a70f5298-da76-46a7-8199-bfd9ddf5ea64`.
- The unrelated root `a.md` was already untracked, was not modified, and was excluded from commits.

## Verification results

- `npm run check`: PASS. Strict TypeScript and ESLint passed in shared, API, and web workspaces; 53 unit tests passed (14 shared, 35 API, 4 web); local static Next export passed.
- `npm run test:e2e`: PASS, 10 Playwright tests. Coverage includes real basemap pixel rendering, resize, style fallback and recovery, WebGL restoration and map reinitialization, search/selection/sort/details/back, GPS denial, reviewed Davao alias merging, global airport preview and no-airport recovery, and 13 responsive viewports (320×568 through 1440×900, including short landscape). The compact international-air fit test also passed three consecutive fresh runs.
- `npm audit`: PASS, zero known vulnerabilities. `git diff --check`: PASS. Airport-index generation was rerun against its pinned OurAirports source; 3,245 records and the documented source hash were stable.
- Preview and production Wrangler dry-runs passed. The static production build gate requires an HTTPS Worker URL; preview and production builds passed with their respective API URLs.
- Preview and production Geoapify credentials are Cloudflare Worker secrets; local development uses ignored `.dev.vars` when configured. Both deployed health endpoints reported `configured.geoapify=true` and `providersProbed=false`. No key is in the browser build or tracked repository files.
- Live preview and production Geoapify searches resolved Davao City Hall, SM Lanang Premier, and Tokyo Tower. Both API deployments returned HTTP 200 for a Davao local comparison with real Geoapify `LineString` route geometry and for Davao→Tokyo international classification with DVO→HND airport candidates and clearly marked demo-model carrier reference estimates. Responses do not claim schedules, service, or bookable fares.
- Preview CORS granted only its active Pages alias (plus localhost for development) and omitted `Access-Control-Allow-Origin` for `https://untrusted.example`. Production granted `https://wandr.ricky.network` and omitted it for the untrusted origin.
- The production site and health endpoint returned HTTP 200. A real production browser session performed Geoapify place searches and Davao→Tokyo comparison at 320×700. The map was ready, showed the air corridor and both airport markers; both markers fit above the results sheet, outside attribution/navigation controls; two options rendered; no browser page errors or console errors occurred. OpenFreeMap emitted nonfatal style-value warnings; viewport-camera movement also aborted superseded tile requests. Neither prevented map use.
- The production deploy is associated with implementation commit `1eb7f94`. A subsequent evidence-only documentation commit is pushed to `main`; it does not change the deployed app or Worker code.

## A01–A40 acceptance matrix

| ID | Status | Evidence / limitation |
|---|---|---|
| A01 | PASS | `npm ci` passed during the initial audit; dependency manifests and lockfile were not changed. |
| A02 | PASS | Current `npm run check` passed typecheck, lint, all 53 unit tests, and static export. |
| A03 | PASS | Geoapify key is Worker-only; deploy builds require an HTTPS API URL; no key is included in static output. |
| A04 | PARTIAL | Live Geoapify route geometry was a `LineString`; `MultiLineString` normalization is fixture-tested but no live response of that type was observed. |
| A05 | PASS | Geometry normalization and malformed/out-of-bounds rejection are unit-tested. |
| A06 | PASS | Live local route requests returned real Geoapify road geometry/distance/time inputs; walking remains subject to the short-walk threshold. |
| A07 | PASS | Production HTTPS app and OpenFreeMap map loaded in the production browser. |
| A08 | PASS | Geoapify, OpenFreeMap, OpenMapTiles, and OpenStreetMap attribution remained visible in automated and deployed browser checks. |
| A09 | PARTIAL | Airport and route map overlays render; a selected local provider road path is not evidence of passenger-route alignment. |
| A10 | PASS | Playwright confirms GPS is not requested on load and is requested only after explicit user action. |
| A11 | PARTIAL | Simulated permission denial preserves manual search; a physical GPS timeout test was not run. |
| A12 | UNVERIFIED | No physical-device GPS grant and live reverse-geocoding test was performed. |
| A13 | PASS | Live preview and production Geoapify searches returned Davao and Tokyo places. |
| A14 | PASS | Live provider searches returned requested Davao civic/commercial places and international place records with provider coordinates. |
| A15 | PARTIAL | Keyboard selection and secondary address are tested; ambiguous same-name live-provider cases are not exhaustively validated. |
| A16 | PARTIAL | Debounce, abort/stale-result handling, bounded cache, and keyboard selection are implemented and fixture-tested; provider quota/race load was not stress-tested. |
| A17 | PASS | Local, domestic-long-distance, and international classifications produce scoped responses; real Davao→Tokyo returns a generic airport corridor with disclosed model references. |
| A18 | PASS | Input validation rejects invalid, incomplete, and identical place selections before provider work. |
| A19 | PASS | Reviewed grayscale interface preserves the phone-first flow without unapproved logos or added marketing sections. |
| A20 | PASS | Desktop shell stays at or below 430px; mobile fills the viewport. |
| A21 | PASS | Automated no-overflow checks passed at 13 mobile, tablet, desktop, and landscape viewport sizes. |
| A22 | PARTIAL | Keyboard search selection and reduced-motion styling exist; full focus/Escape/device accessibility matrix was not run. |
| A23 | PARTIAL | Loading, cancel, retry, retained place selections, and visible API errors exist; every offline/provider-timeout state was not exercised end to end. |
| A24 | PASS | Sorting is local and deterministic; route results do not make another compare request when sorted or opened. Unknown values cannot win a badge. |
| A25 | PARTIAL | Walking and road inputs are provider-derived; fares and air durations are disclosed estimates. No verified passenger journey or ride-hailing quote is available. |
| A26 | BLOCKED | No two source-backed Davao passenger journeys with stop order and direction were available. |
| A27 | BLOCKED | No accepted, current route-linked fare matrix is integrated. |
| A28 | PASS | Unknown fare/time values are displayed as unavailable and cannot be ranked as cheapest/fastest. |
| A29 | PASS | Unit/API tests enforce configured short-walk distance and duration limits. |
| A30 | PARTIAL | Provider step normalization is fixture-tested; live turn-by-turn steps were not independently verified. |
| A31 | PARTIAL | Details disclose route references and estimates and do not claim booking; no external turn-by-turn handoff exists. |
| A32 | PASS for exercised lifecycle | One-map lifecycle, resize, style recovery, WebGL restoration, and reload checks passed; long-duration leak/memory testing was not performed. |
| A33 | PASS | Validation tests and live CORS checks accept the configured site and reject an unrelated origin. |
| A34 | PASS | Quota/timeout/abort cases and Worker rate limiting are unit-tested; live upstream quota exhaustion was not induced. |
| A35 | BLOCKED | Authorized route/stop records and a traceable linked fare matrix are still absent; route and fare source integrity cannot be evaluated without them. |
| A36 | PASS | Preview Pages and Worker are deployed from the implementation commit; real preview search/compare and browser route passed. |
| A37 | PASS | Production custom domain and API return HTTPS 200; live production CORS is restricted to the site origin. |
| A38 | PASS | Production Pages and Worker are deployed from `main` commit `1eb7f94`; live search, route comparison, map, and 320×700 browser flow passed. |
| A39 | BLOCKED | No production passenger-route/fare comparison is possible until A26/A27/A35 sources are supplied and approved. |
| A40 | UNVERIFIED | No physical iOS or Android browser/device test was performed. |

## Remaining limits

1. Wandr is a scoped transport-estimate demo, not a verified public-transit, ride-hailing, or flight-booking comparison service. There is no authorized/live Grab, Maxim, Green GSM, or airline quote/schedule integration; air references are not fare availability.
2. No two repeatable Davao passenger journeys with stop/direction evidence and an applicable current fare source are available. Phase 4 passenger-transit comparison remains blocked pending approved source data and reuse permission.
3. Physical Android/iOS interaction, GPS grant/timeout, and device-network behavior remain unverified.

See [DATA_SOURCES.md](./DATA_SOURCES.md), [ARCHITECTURE.md](./ARCHITECTURE.md), [BRAND_ASSETS.md](./BRAND_ASSETS.md), and [README.md](../README.md) for implementation and source boundaries.

## Follow-up UI polish release — 2026-11-08

This follow-up supersedes the older release IDs and test counts above for current `main` and the current production deployment. The follow-up began from `190f898d2191911659d94f31d8c04ec44f9ed06a`, applied the five correction phases sequentially, and pushed app/API code SHA `bd423c3cfdd43268e5f3b35d192a03126172fb14` plus test-only commits `e7e799ec2ee95571cdc83058ec1ac1dd7c2b8b22` (browser Back) and `61f8d069ce0968941964a1a8b00254118754f799` (duplicate campus destination) to current `main`.

- Production Pages: deployment `b9b728df-ed11-4bca-8651-d90496eca21c`, branch `main`, source `bd423c3`, live at [wandr.ricky.network](https://wandr.ricky.network/).
- Production Worker: version `f2db4893-ae25-40d6-bd0b-4274ce1abf28`, custom domain [api.wandr.ricky.network](https://api.wandr.ricky.network/v1/health); health returned 200 and `configured.geoapify=true` without exposing the key.
- Preview Pages: deployment `f2b08d06-84bc-4245-8200-b8c2bb26d289`, branch `codex-wandr-full-correction-oiad`; preview Worker version `750c6228-0f20-43f6-b67c-b3cc5bf71d15`.
- `npm run check`: PASS, strict TypeScript, ESLint, 55 unit tests (15 shared, 36 API, 4 web), and Next static export. Production build with the production HTTPS API URL also passed.
- `npm run test:e2e`: PASS, 13/13 with one worker to avoid cross-browser screenshot/WebGL contention. Includes 50 fixture screenshots across the ten required viewports and five screens, no-overflow and metric-child geometry, pinned scroll controls, 150% text scale, 320×360 short keyboard, keyboard focus and reduced-motion checks, and the existing map/network/navigation suite. The latest tests invoke actual browser Back as well as in-app details Back and verify both preserving a different destination and clearing a duplicate campus destination.
- `npm audit --audit-level=moderate`: PASS, zero known vulnerabilities. Preview and production Wrangler dry-runs and `git diff --check`: PASS.
- Both deployed APIs completed live Geoapify search, AdDU Jacinto → Davao City Hall road comparison, and Davao → Tokyo comparison. Live routes returned Geoapify `LineString` road geometry; live international comparison resolved DVO→HND and two demo-model carrier options. Preview and production CORS granted only their configured origin and omitted the allow-origin header for an unrelated site.
- Preview and production browser sessions showed the selected AdDU campus origin/A map marker, real named-place results, all four local provider identities and supplied logos, PAL/Cebu cards, correct airfare labels, details, and two endpoint entries. At production 320×568 the DVO/HND markers were above the results sheet; three detail metrics were adjacent in one row, and document, shell, and sheet overflow checks were false.
- Screenshot evidence is stored in [`evidence/ui-polish/`](./evidence/ui-polish/); deterministic fixture captures are explicitly distinguished from live integration. The full acceptance map is in [`UI_POLISH_REPORT.md`](./UI_POLISH_REPORT.md).

The live map emitted nonfatal OpenFreeMap style warnings for null shield values and aborted tile requests after camera movement; it remained ready, with no fit warning or page error. No physical iOS/Android, GPS permission grant, or GPS timeout run was performed. User-supplied SVG license/reuse terms remain unverified. Demo prices and air corridors are estimates/previews, not live operator quotes, passenger service, or flight schedules.
