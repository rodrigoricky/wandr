# Wandr Blue UI v2 validation report

This report records the ordered implementation and verification for `WANDR_BLUE_UI_V2_STRICT_PROMPT.md`.

## Recovery point

- Pre-change `main`: `859324d73e31a81a4a797f4b4869fff37efa9a07`.
- Remote recovery branch: `origin/snapshot/pre-blue-ui-20261108-859324d`.
- Bundle: `/tmp/wandr-pre-blue-ui-859324d73e31a81a4a797f4b4869fff37efa9a07.bundle`.
- Bundle SHA-256: `b199836986a029ffa702daa4dcdfc8e87d5b0d682aaacc72084cfc93e5e81814`.
- Restore check: `git bundle verify` and a fresh clone both resolved to the recorded pre-change commit.

## Ordered implementation commits

1. `e7becaa` — baseline screenshots and live API evidence.
2. `9c86f9f` — compact attribution, exact demo location action, and 60/40 results layout.
3. `98fc954` — Wandr blue design tokens and component styling.
4. `70d2879` — iOS and Android presentation variants.
5. `34f429c` — persistent segmented-control indicator and micro-interactions.
6. `5015eb7` — visual matrix, platform, layout, and interaction regression coverage.
7. `58ee034` — deterministic recovery when a primary map style retry stalls.
8. `ff6ce03` — keep real air-route airport markers above the compact results sheet at 320×700.
9. `d26f333` — preserve navigation/attribution clearance on long-haul air routes while retaining the short-haul inset.

## Implementation evidence

- Results sheets use a bounded 60% viewport height with the existing card stack preserved.
- Search, details, and loading states retain the 40% map inset.
- MapLibre attribution remains visible and compact, including Geoapify, OpenFreeMap, and OpenStreetMap credits.
- Road routes use Wandr blue; air corridors use navy dashed styling; provider logos and route data remain unchanged.
- The demo action is exactly `Use my current location`; it keeps the AdDU Jacinto fixture and does not invoke GPS or reverse geocoding.
- The segmented control keeps a persistent animated indicator, keyboard semantics, and reduced-motion behavior.
- Platform presentation defaults to iOS and switches to Android only for Android phone user agents; route/search behavior is shared.
- Primary-style failure still falls back to OSM raster and now retries OpenFreeMap cleanly when connectivity returns.

## Automated gates

| Gate | Result | Evidence |
| --- | --- | --- |
| TypeScript, ESLint, unit tests, static build | Passed | `npm run check` |
| End-to-end suite | Passed: 14/14 | `npm run test:e2e` |
| Dependency audit | Passed: 0 vulnerabilities | `npm audit --audit-level=moderate` |
| Patch whitespace | Passed | `git diff --check` |

The full end-to-end run covers production basemap pixels, sprite failure, fallback/recovery, WebGL restoration, local and air routing, demo behavior, provider identities, unresolved airport recovery, viewport constraints, the 10-viewport UI matrix, large-text/short-keyboard behavior, and Android presentation detection.

## Visual and integration evidence

- Baseline screenshots and live API request/response captures are in [`baseline/`](./baseline/).
- Post-change screenshots are in [`after/`](./after/), 50 captures covering Search, Local Results, Local Details, Air Results, and Air Details at 10 required viewport sizes.
- Baseline proportions measured the old results sheet at roughly 74%; the new regression assertion requires 54–66%, and the matrix passed.
- Baseline live API checks covered Davao local routing and Davao-to-Tokyo air routing against `https://api.wandr.ricky.network` with Geoapify configured.
- Physical iOS/Android devices were not available in this environment; browser viewport and Android user-agent checks passed.
- Source logo licensing was not independently re-audited in this UI-only change; existing provider assets and attribution remain intact.

## Deployment status

- Feature branch `codex/wandr-blue-ui-v2-20261108` was pushed, then fast-forwarded to `main` and pushed without force. Final application commit is `d26f333` before this documentation update.
- Preview Pages deployment: `7807b1ca-e7cb-433d-8c7a-fd0c78c9d7b2`, source `d26f333`, alias [`codex-wandr-full-correction-8jjh.wandr-ld1.pages.dev`](https://codex-wandr-full-correction-8jjh.wandr-ld1.pages.dev/).
- Preview Worker version: `5577c1d0-b0e1-45c0-8065-1a53e0a09fb9`, [`wandr-api-preview.rickyrodrigo-ph.workers.dev`](https://wandr-api-preview.rickyrodrigo-ph.workers.dev/v1/health).
- Production Pages deployment: `78a75637-675e-4212-b668-070246da2824`, source `d26f333`, custom domain [`wandr.ricky.network`](https://wandr.ricky.network/).
- Production Worker version: `f132dcc3-b48c-4eab-927b-3f21df1c3e98`, custom domain [`api.wandr.ricky.network/v1/health`](https://api.wandr.ricky.network/v1/health).
- Preview and production health returned HTTP 200 with `configured.geoapify=true`; live Geoapify place search returned Davao City Hall and Tokyo Tower; live local comparison returned a real Geoapify `LineString`; live Davao-to-Tokyo comparison returned DVO/HND, a schematic air corridor, and two disclosed reference options.
- Preview browser check rendered the new blue UI, compact attribution, AdDU Jacinto demo origin, Geoapify Davao City Hall selection, and all four local provider cards. Production browser check repeated the same flow at [`wandr.ricky.network`](https://wandr.ricky.network/), with no page errors; only the known nonfatal OpenFreeMap style warnings were observed.
- Production CORS allowed `https://wandr.ricky.network` and omitted `Access-Control-Allow-Origin` for `https://untrusted.example`.
