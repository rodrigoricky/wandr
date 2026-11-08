# Wandr Blue UI V2 baseline

Captured before application changes on 2026-11-08.

## Audited revision and recovery

- Starting branch and `origin/main`: `859324d73e31a81a4a797f4b4869fff37efa9a07` (`docs: record final Pages production deployment`).
- Implementation branch: `codex/wandr-blue-ui-v2-20261108`, created from that SHA.
- Tracked worktree was clean. Existing untracked `.DS_Store` and `a.md` were preserved and excluded from the snapshot and evidence commit.
- Remote recovery ref: `origin/snapshot/pre-blue-ui-20261108-859324d`, verified with `git ls-remote` to the starting SHA.
- Local recovery bundle: `/tmp/wandr-pre-blue-ui-859324d73e31a81a4a797f4b4869fff37efa9a07.bundle`; SHA-256 `b199836986a029ffa702daa4dcdfc8e87d5b0d682aaacc72084cfc93e5e81814`. `git bundle verify` passed. A fresh clone from the bundle had the exact same `HEAD`.
- Restore into a separate checkout: `git clone /tmp/wandr-pre-blue-ui-859324d73e31a81a4a797f4b4869fff37efa9a07.bundle wandr-pre-blue-ui-restore`. The immutable remote branch can also be checked out. No existing branch was overwritten.

## Existing deployment

- Production Pages: `https://wandr.ricky.network`, deployment `ba6c9f45-8f0b-4dec-9582-ab327fffb3b8`, branch `main`, source `40ac1d5` (HTTP 200).
- Production API: `https://api.wandr.ricky.network/v1/health`, active Worker version `f2db4893-ae25-40d6-bd0b-4274ce1abf28`; health returned `status=ok`, `configured.geoapify=true`, and did not disclose the key.

## Baseline checks

- `npm run check`: PASS — shared/API/web strict TypeScript, ESLint, 55 unit tests (15 shared, 36 API, 4 web), and local static Next build/export.
- `npm run test:e2e`: PASS — all 13 Playwright tests; fixture and simulated failure tests are not counted as live-provider checks.
- `npm audit --audit-level=moderate`: PASS — zero vulnerabilities.
- `git diff --check`: PASS before and after evidence capture.
- Source/deployment audit: all specified source paths exist, including the map, search/results/shell components, shared contracts and estimates, API compare/geocoding services, manifests, config, test reports, and all five local SVG brand files. Current behavior/state and relevant CSS were inspected in `page.tsx`, `globals.css`, `WandrMap.tsx`, and existing Playwright coverage. Map attribution currently uses MapLibre's provider metadata, Geoapify custom link, and OSM fallback source attribution.

## Before screenshots

`baseline/` contains 50 fresh Playwright screenshots from the current source revision, using deterministic local/air fixture inputs. It covers Search, Local Results, Local Details, Air Results, and Air Details at 320×568, 320×700, 360×640, 375×667, 390×844, 430×932, 600×820, 768×1024, 1280×800, and 844×390. These screenshots are layout fixtures, not provider evidence. They can be compared with the post-change screenshots in `../after/` once captured.

## Live production integration baseline

The production browser performed real Geoapify search and comparison (no intercepted requests): campus → Davao City Hall returned four local provider cards with a live road `LineString`; campus → Tokyo Tower returned Philippine Airlines and Cebu Pacific, DVO→HND airports, both airport markers, and the schematic corridor. The supplied SVG logos loaded in cards. Browser console also logged nonfatal OpenFreeMap style warnings and map tiles aborted during camera changes.

The exact request objects and raw response bodies are stored in `baseline/local-request.json`, `baseline/local-compare.json`, `baseline/air-request.json`, and `baseline/air-compare.json`. Inputs use the established AdDU Jacinto origin (Geoapify ID and coordinates 7.072316, 125.612838), the production Geoapify Davao City Hall search result, and a production Geoapify Tokyo Tower result. The results include:

- Local: `davao_city` / `local`; providers `grab_taxi`, `green_gsm_taxi`, `maxim_motorcycle`, `jeepney`; demo fares PHP 90–120, 80–110, 30–60, and 14; duration estimates 600s for the three road references and 900s for Jeepney; Geoapify road geometry is a `LineString` of 1,628m. UI cheapest order was Jeepney, Maxim, Green GSM, Grab; faster order is based on unchanged shared sorting and the equal 600s estimates.
- Air: `international`; airports DVO/HND; air corridor is `LineString`, 3,473,960.26m, 23,400s; providers `philippine_airlines` (PHP 10,700–16,060) and `cebu_pacific` (PHP 8,430–13,200), both explicitly `estimated_demo`; both sorts tie on the same ETA and preserve deterministic fare tiebreaking, so Cebu Pacific precedes Philippine Airlines.

These are demo estimates, not live fares, schedules, service availability, or bookable offers. `generatedAt` and provider routing can change; compare only semantic fields and geometry source/type/distance, not the timestamp or byte-for-byte body.

## Baseline findings to address or preserve

- The results sheet is currently about 74% of the app viewport at 375×667 (493.6px) and 390×844 (624.6px), leaving about 26% of map visible; at 1280×800 the 418×764 app frame has a 565.4px sheet (74%). At 430×932 the sheet cap makes it 650px (69.7%). This misses the requested 60/40 split.
- At 390×844 the air result sheet begins at y=219.4 while DVO/HND markers are at y=480/336, behind the sheet. At 320×568 DVO is behind the sheet and HND is partly above it. At 320×360 the air result camera fit logs `Map cannot fit within canvas with the given bounds, padding, and/or offset`, and markers are below the sheet. Page, shell, and sheet horizontal overflow were false in these sampled states.
- Attribution expands into four links/text items (Geoapify, OpenFreeMap, OpenMapTiles, OpenStreetMap), forming a large white control block on the map.
- The visible demo shortcut says `Use AdDU Jacinto`; its verified current behavior is covered by tests and it makes no GPS/reverse lookup request.
- The primary action and map-route accent are near black. Current controls are shared; the Android styling variant and animated selected pill do not yet exist.

The snapshot, fixture screenshots, raw response fixtures, and this report form Gate 0. The first application change occurs in the next commit.
