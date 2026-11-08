# Wandr UI polish correction report

Updated 2026-11-08. Scope: the complete A–E correction sequence in `WANDR_UI_POLISH_CORRECTION.md`. The work was based on `origin/main` at `190f898d2191911659d94f31d8c04ec44f9ed06a`; each correction phase was committed separately on `main`. The code release commit is recorded below after production deployment.

## Release and integration evidence

| Environment | Pages | Worker | Evidence |
|---|---|---|---|
| Preview | [Wandr preview](https://codex-wandr-full-correction-k8pn.wandr-ld1.pages.dev/) — deployment `f2b08d06.wandr-ld1.pages.dev` | `https://wandr-api-preview.rickyrodrigo-ph.workers.dev`, version `750c6228-0f20-43f6-b67c-b3cc5bf71d15` | Live browser check showed AdDU Jacinto preselected and pinned, real Davao City Hall search, Geoapify-backed local road route, the four requested local identities and loaded SVGs, then a Davao→Tokyo Geoapify search with DVO→HND, PAL/Cebu cards, and both air pins above the sheet at 320×568. No horizontal overflow; map remained ready. Live API returned Geoapify `LineString` road geometry, international corridor, and restricted CORS. |
| Production | [wandr.ricky.network](https://wandr.ricky.network/) — Pages deployment `b9b728df-ed11-4bca-8651-d90496eca21c`, `main`, source `bd423c3` | [Production health](https://api.wandr.ricky.network/v1/health) — Worker version `f2db4893-ae25-40d6-bd0b-4274ce1abf28` | HTTPS 200 for site, health, Geoapify autocomplete, local and air compare. Real browser exercised campus start → Davao City Hall → local cards → detail/back → Tokyo Tower → air cards and detail. At 320×568, both airport markers were fully above the sheet; all three detail metrics remained one row and document/shell/sheet overflow were false. Production CORS returned only the configured site origin. |

## Acceptance matrix T01–T23

Fixture-driven UI checks below are identified as deterministic browser tests. They do not count as live place search or routing. Real upstream integration evidence is separately called out.

| ID | Status | Evidence |
|---|---|---|
| T01 | PASS | Formatting unit tests cover 59s, 600s, 3600s, 3900s, null and invalid values; concise `~` time style is centralized. Visible result/detail text is scanned for the specified verbose phrases. |
| T02 | PASS | Unit and browser tests verify ordinary peso ranges, compact large ranges, full accessible fare labels, no ellipsis, and em dash for missing fares. |
| T03 | PASS | Land and air details use the exact `Distance` label and their appropriate route distance. Cards show concise ETA. |
| T04 | PASS | Playwright captured five states—Search, Local Results, Air Results, Local Details, Air Details—at ten required sizes (50 after screenshots). Baseline local/air result/detail screenshots cover the eight specified pre-polish sizes. See [before/](./evidence/ui-polish/before/) and [after/](./evidence/ui-polish/after/). |
| T05 | PASS | Browser assertions check the three metric labels and same-row geometry, each metric's `scrollWidth <= clientWidth`, and document/shell/sheet horizontal overflow at every viewport. |
| T06 | PASS | Fixture browser test includes PAL/Cebu long fares, long provider names, 150% root text scale, and a 320×360 short keyboard-height viewport. |
| T07 | PASS | Seven-card fixture list demonstrably scrolls; matching sort-control and trip-summary rectangles remain unchanged. |
| T08 | PASS | Playwright trip flow covers manual search, swap, sort, selecting details, detail Back, browser Back, Edit trip, and one compare request (no extra request on sort/detail/back). |
| T09 | PASS | Existing map tests verify real rendered OpenFreeMap pixels, attribution, resize, sprite failure, OSM fallback/recovery, WebGL context recovery, and map reinitialization. Air-route fixture asserts the two airport pins and air map state. |
| T10 | PASS | Live preview Davao comparison returns Grab Taxi, Green GSM Taxi, Maxim Motorcycle, and Jeepney; fixture assertions check no generic car/taxi/motorcycle identities and verify corresponding tints/assets. |
| T11 | PASS | Live preview Davao→Tokyo yields PAL and Cebu Pacific reference cards with `DVO → HND`; both show concise fare and ETA. Carrier amounts remain demo-model estimates. |
| T12 | PASS | All five local SVG files resolve in the static build and browser checks observe nonzero image natural widths. Their viewBox/art bounds, non-external content, and rights caveats are documented in [BRAND_ASSETS.md](./BRAND_ASSETS.md). |
| T13 | PASS | Browser checks assert restrained provider tint values and a white monochrome Jeepney card. |
| T14 | PASS | Shared model tests check deterministic estimates, sort order, and equal-time tie behavior without claiming a unique fastest option. |
| T15 | PASS | Local/air result and detail sheets are checked against the prohibited-copy list. Model/source notes remain in internal data and documentation. |
| T16 | PASS | First-open UI selects the verified Jacinto/Main Campus place, destination is empty, and the map shows the A marker. The first compare test checks the exact Geoapify ID and coordinates. |
| T17 | PASS | Campus action test asserts zero `navigator.geolocation` calls and zero reverse-geocode calls; manual origin reset preserves a different selected destination and clears a duplicate campus destination. Live preview confirms the campus is the deployed initial start. |
| T18 | PASS | Existing manual search/swap/edit/back E2E plus campus-reset flow pass; user-selected places are not silently replaced by the demo origin. |
| T19 | PASS | Preview and production API searches resolve live Geoapify Davao/Tokyo places; both preview and production accept the exact 205-character AdDU ID and return live Davao road `LineString` geometry. Live production browser submitted the route successfully. The Geoapify key is not sent to the browser. |
| T20 | PASS | Live preview and production Davao→Tokyo showed DVO and HND pins, air corridor, and a ready map. In both sessions at 320×568 both marker rectangles were above the results sheet (sheet top y=218; marker tops y=134 and y=183), and page horizontal overflow was false. Automated camera-fit warning checks pass. |
| T21 | PASS | Automated tests cover keyboard search selection, visible focus outlines, reduced-motion computed transition behavior, map attribution, and map fallback/recovery. |
| T22 | PASS | Worker unit tests cover rate limiting, validation, and configured CORS. Live preview and production CORS return their configured Pages origin and omit the header for an untrusted origin; health confirms Geoapify configuration without exposing the secret value. |
| T23 | PASS | Fixtures label synthetic route and price inputs as fixtures; live API inspection confirms real Geoapify geometry but `estimated_demo` carrier/provider fare statuses. No provider booking or airline schedule integration is claimed. |

## Changed code and retained limits

The implementation changes are in the phase commits listed in `git log` plus the final Phase E/API boundary correction. Phase A updates formatting and visible copy; B makes the controls/trip summary stay fixed while only the card viewport scrolls; C installs and maps the supplied logos and explicit provider IDs; D uses the verified AdDU pin. Phase E adds matrix/evidence coverage, raises Geoapify input ID capacity, and stabilizes the resource-intensive Playwright suite by running a single browser worker.

Fare values and air travel times remain deterministic demo estimates. A route line is geographic or road reference geometry, not proof of operator service, a passenger route, a schedule, a flight, or a live fare. The five SVGs were user-supplied and contain no license terms; their reuse permissions are not independently verified. Physical Android/iOS device and real GPS-permission tests were not performed.

## Final release record

The production app and Worker code release SHA on `main` is `bd423c3cfdd43268e5f3b35d192a03126172fb14`. Follow-up test-only commits `e7e799ec2ee95571cdc83058ec1ac1dd7c2b8b22` (browser Back) and `61f8d069ce0968941964a1a8b00254118754f799` (duplicate demo destination) are also pushed; `61f8d06` is the latest implementation/test commit. The final report and evidence are committed to `main` after that. The ordered correction commits were fast-forwarded from audited `origin/main` (`190f898`) without force. Exact final commands and counts: `npm ci` passed during audit; `npm run check` passed (strict typecheck, ESLint, 55 unit tests, static local export); `npm run test:e2e` passed 13/13 after the final navigation and campus reset assertions; `npm audit --audit-level=moderate` reported zero vulnerabilities; production and preview `wrangler deploy --dry-run` passed; production `NEXT_PUBLIC_API_BASE_URL=https://api.wandr.ricky.network npm run build:web` passed; and `git diff --check` passed. Screenshots are deterministic fixtures and are clearly separated from live preview/production integration checks.

The real browser logged nonfatal OpenFreeMap style-value warnings for null highway-shield values and superseded vector-tile requests aborted during camera movement; the map remained ready and usable. No map-fit warning or browser page error occurred. No physical iOS/Android device or GPS permission grant/timeout test was performed. The supplied SVG files do not contain licensing terms, so reuse rights remain unverified.
