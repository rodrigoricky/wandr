# Wandr Blue UI v2.1 correction evidence

Updated 2026-11-09. This report records the ordered implementation, verification, merge, and production deployment for `WANDR_BLUE_UI_V2_1_CORRECTION_PROMPT.md`.

## Snapshot and audit

- Audited `main` and `origin/main` at `6c96f0f4d2937f1cc16541e0b6c6cce080a822f4` before modifying code.
- Created and pushed rollback branch `snapshot/pre-blue-ui-v2-1-20261109-6c96f0f` at that exact SHA.
- Created `/tmp/wandr-pre-blue-ui-v2-1-6c96f0f4d2937f1cc16541e0b6c6cce080a822f4.bundle`; `git bundle verify` passed and a fresh clone resolved the exact baseline SHA. Bundle SHA-256: `f5c69d22e38fc59467307e0f557da133cce93834b4a86f488d06f80ad81a6e7a`.
- Preserved pre-existing untracked `.DS_Store`, `a.md`, and root `logo.png`; they were not staged or changed.
- Root `logo.png` was inspected as a 1240×1748 RGBA PNG. The shipped [`apps/web/public/logo.png`](../../apps/web/public/logo.png) is byte-identical (SHA-256 `2955ba056032dc5c6329d35ec526e3f1bdae61e34ffdd7039c2424ceb0f932db`).

## Ordered implementation

1. **Phase A — compact trip summary**
   - Commit `3ae5c63` (`fix(ui): bound trip summary endpoints independently`).
   - Removed the standalone visible “Estimates” note.
   - Added independently truncating origin and destination endpoints, a visible arrow, and the existing `Edit trip` action without changing place IDs, coordinates, or API payloads.
   - Added the long/short endpoint regression across all four combinations.

2. **Phase B — OpenFreeMap blue accents**
   - Commit `08df115` (`style(map): apply restrained blue accents to vector layers`).
   - Verified the live Positron style layer IDs and types before implementation.
   - Added an idempotent `style.load` helper that tints only verified background, water, park, residential, waterway, pier, and road casing/inner layers. Label and POI symbol layers remain provider-owned. Fallback OSM raster remains untinted.
   - Added primary, fallback, and recovered-primary assertions for the map theme metadata.

3. **Phase C — delayed supplied-logo overlay**
   - Commit `6e9b180` (`feat(map): reveal supplied logo during slow initial loads`).
   - Added the exact root asset to `apps/web/public/logo.png`.
   - Added a 275 ms initial threshold, fade-out after the first usable ready/degraded state, immediate clearing on failure, reduced-motion handling, and a one-shot outcome ref so later map updates do not replay the overlay.
   - Kept the existing dynamic import fallback blank and `aria-hidden`; the overlay is the only map loading status.

## Automated verification

- `npm run check` passed: strict TypeScript, ESLint, 15 shared tests, 36 API tests, 4 web unit tests, and the static local build.
- `npm run test:e2e` passed **19/19** in 2.7 minutes on the final pushed tree. This includes the required responsive UI matrix, map pixel/resource checks, fallback and recovery, WebGL restoration, route flows, long/short endpoint bounds, logo asset, slow cold load, reduced motion, warm update/no replay, and dual-provider failure clearing.
- `npm audit --audit-level=moderate` passed with `found 0 vulnerabilities`.
- `npm run deploy:dry-run -w @wandr/api` passed for the production Worker (676.52 KiB upload preview, 3 ms startup).
- `NEXT_PUBLIC_API_BASE_URL=https://api.wandr.ricky.network npm run build:web` passed with static `/` and `/_not-found` output.
- `git diff --check` passed before merge.

## Visual evidence

- Baseline captures: [`baseline/`](./baseline/) contains the 20 required shared screen/viewport captures from the audited version.
- Final captures: [`after/`](./after/) contains 50 captures from the final 10-viewport matrix for search, local results/details, and air results/details.
- The 20 common baseline/final images were compared with a pixel diff. All common images retained their expected dimensions; changes are concentrated in the map/sheet regions where the approved blue vector styling and compact summary apply. A representative 390×844 local-results comparison shows the removed “Estimates” label, bounded endpoint summary, and blue water/land/road layers.

## Merge and deployment

- Feature branch `codex/wandr-blue-ui-v2-1-20261109` was pushed, then fast-forwarded into `main` without force-pushing.
- The correction commits are present on pushed `main`; the deployed application bundle is sourced from app commit `6e9b180`.
- Production API Worker deployed with Wrangler v4.158.0 under Node 22.22.3:
  - Worker: `wandr-api-production`
  - Version: `34ddded0-ec05-4e5d-aafa-7aef1e8e6efe`
  - Custom domain: `api.wandr.ricky.network`
- Production Pages deployed from `apps/web/out` to project `wandr`, branch `main`:
  - Deployment ID: `54d3c125-674a-45aa-bfed-58fa3f340d46`
  - Deployment URL: `https://54d3c125.wandr-ld1.pages.dev`
  - Custom domain: `https://wandr.ricky.network/`
- The Pages deployment source is app commit `6e9b180`; later `main` commits add only tests and evidence documentation, with no app bundle changes.

## Real production checks

- `https://wandr.ricky.network/` returned HTTP 200 and served the updated static shell.
- `https://wandr.ricky.network/logo.png` returned HTTP 200, `image/png`, 1,252,978 bytes.
- `https://api.wandr.ricky.network/v1/health` returned HTTP 200 with `configured.geoapify: true`.
- Production Geoapify search for `Davao City` returned HTTP 200 with six places.
- Production local compare returned HTTP 200, `journeyType: local`, `scope: davao_city`, four options, a real `LineString` Geoapify leg, and `availability: estimated_demo`; CORS returned only `https://wandr.ricky.network`.
- A fresh production browser session loaded the OpenFreeMap map, showed the AdDU demo origin, completed a real Davao City Hall search, and rendered the Route options summary with the arrow and `Edit trip` control.
- Production DOM readback confirmed `data-map-ready="true"`, `data-map-provider="openfreemap"`, `data-map-theme="wandr-blue"`, all 11 verified theme layer IDs, zero loading overlays after readiness, and the compact summary text.

## Remaining limits

- No external blocker remains for the requested MVP corrections.
- Physical iOS/Android hardware and native webviews were not available; responsive browser emulation and reduced-motion checks passed.
- OpenFreeMap continues to emit provider-side style-filter and missing-sprite warnings in the browser console. The tested primary map remains usable, the warning does not trigger fallback, and the approved fallback/recovery behavior passes.
