# Implementation status

## Checkpoint 0 — fresh audit (2026-11-08)

- Repository: `main` at `4d520936fb96a561a570451fab4b87b1c6c82148`, clean and equal to `origin/main` before this work. Work is proceeding on `codex/wandr-full-correction-20261108`.
- Baseline install and checks: `npm ci` passed (235 packages, 0 audit findings); `npm run check` passed (typecheck, lint, 17 unit tests, static Next export); `npm run test:e2e` passed (3 fixture-driven Chromium tests); `npm audit` passed; `npm run deploy:dry-run -w @wandr/api` passed (14.22 KiB / 4.50 KiB gzip). These do not verify external services.
- Baseline local Worker: `/v1/health` returned configured=false and providersProbed=false; place search returned `503 CONFIGURATION_MISSING`; reverse lookup returned honest coordinate fallback; unauthorized-origin preflight had no `Access-Control-Allow-Origin`.
- Baseline screenshot: `/tmp/wandr-baseline.png` (local Chromium, 390 × 844). It shows the current title, Davao pill, teal controls, small 210 px map and disclaimer-like copy, which conflict with the requested design.
- Routing defects reproduced by source review: `apps/api/src/providers/geoapify.ts` only accepts `LineString` and drops route legs/steps; autocomplete applies a Davao rectangle filter; provider fields are reduced to an address string. Geoapify's current routing docs describe `MultiLineString` geometry with one line per leg. Live route/search could not be attempted because neither `GEOAPIFY_API_KEY` nor `apps/api/.dev.vars` exists.
- Coverage defect reproduced: `apps/api/src/lib/validation.ts` combines a broad coordinate box with a `Davao` label regex, rejecting accurately named places by text and preventing global selection from reaching honest coverage handling.
- UI and map defects reproduced: `apps/web/app/page.tsx` mounts separate map instances by screen; map layers and marker styling use teal; the current screen contains visible brand/marketing content; picker says Davao-only and displays whole address as its primary name. GPS is only invoked after its explicit button, but grant and real-device behavior remain unverified.
- Transport data: both local route/fare JSON arrays are empty. No independently verified passenger route, stop, service area or current fare source is currently encoded.
- Cloudflare: authenticated account access is present. No `wandr` Pages project or `wandr-api-preview` / `wandr-api-production` Worker exists. `wandr.ricky.network` and `api.wandr.ricky.network` did not resolve during this audit. Do not change the existing unrelated Pages projects or domains.

## Phase checkpoints

| Phase | Status | Evidence / remaining gate |
|---|---|---|
| 1. Live providers, GPS and map routes | PARTIAL — live gate blocked | Parser and map support LineString/MultiLineString, ordered legs, instructions, metric normalization, invalid geometry, timeout/quota/configuration errors, and abort propagation. `npm run check` passes (21 unit tests); `npm run test:e2e` passes (3 Chromium fixture flows). No Geoapify key exists, so real Davao routing and real browser line verification are BLOCKED. |
| 2. Worldwide establishment search | In progress | Baseline hard-filters to Davao; live key missing. |
| 3. Grayscale map-first UX | In progress | Baseline screenshot/source mismatch; responsive fixture tests cover only 8 widths. |
| 4. Verified Davao passenger options | Blocked on traceable operating route and fare evidence | Empty datasets; do not fabricate options. |
| 5. Staging, production and handoff | Blocked on live provider configuration and target DNS/project | Cloudflare authentication exists, but resources/domains are absent. |

See [TEST_REPORT.md](./TEST_REPORT.md) for the baseline command results and acceptance matrix. This status is updated as each phase is executed; baseline passing tests are not live integration evidence.
