# Wandr

Wandr is a map-first trip planner prototype. Place search is worldwide; transport comparison is currently restricted to an approximate Davao City coordinate area. The Worker returns provider-routed walking paths and a driving road-time baseline only. It does not claim that a taxi, jeepney, bus, tricycle, or ride-hailing service is available, and it has no verified local passenger-route/fare dataset. See [implementation status](./docs/IMPLEMENTATION_STATUS.md) and [data-source evidence](./docs/DATA_SOURCES.md) before treating this as a transport-comparison product.

## Requirements

- Node.js 22 or newer and npm 10 or newer
- A Geoapify API key for live autocomplete, reverse geocoding, walking routes, and driving routes
- Cloudflare account access and authorized domains for deployment

## Local development

```sh
npm ci
cp apps/api/.dev.vars.example apps/api/.dev.vars
```

Put the Geoapify key in the ignored `apps/api/.dev.vars` file. Do not put it in a `NEXT_PUBLIC_*` variable, source code, or the static web bundle. Start the Worker and web app in separate terminals:

```sh
npm run dev:api
npm run dev:web
```

The web app is served at `http://localhost:3000`; the Worker is at `http://localhost:8787`. Next development mode uses the local Worker URL by default. If the API key is absent, the Worker reports `CONFIGURATION_MISSING` for provider-backed requests rather than returning sample data.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run build:web
npm run build:web:local
npm run test:e2e
npm audit
npm run deploy:dry-run -w @wandr/api
```

`npm run build:web` is the deployment build and requires `NEXT_PUBLIC_API_BASE_URL` to be set to the target HTTPS Worker URL. `npm run build:web:local` is a static-export check that explicitly embeds the local Worker URL. Playwright browser tests intercept the API with deterministic test fixtures; they do not prove Geoapify connectivity or deployed behavior. Run a separate live integration check against a configured key and a staging deployment before making live-service claims. The current live integration and deployment blockers are listed in [docs/TEST_REPORT.md](./docs/TEST_REPORT.md).

## Architecture and behavior

- `apps/web` is a Next.js static export served from `apps/web/out`. It uses one persistent MapLibre map beneath the search, results, and route-detail sheets.
- `apps/api` is a Cloudflare Worker. It validates request data, restricts CORS to configured origins, rate limits search/compare requests, and owns Geoapify calls and the provider secret.
- `packages/shared` holds the API contract and geographic normalization.
- Worldwide place lookup is separate from transport coverage. Places outside the current approximate Davao coverage return an explicit unsupported-journey response.
- Walking is only included in standard comparisons if its provider route is at most 1.5 km and 25 minutes. A road driving duration is shown as an estimate, but cannot win “Get there faster” because it is not a complete passenger journey. Unknown fares are not ranked as cheap.
- Map tiles come from OpenFreeMap's Positron style; attribution remains visible. Place and route provider attributions are shown where required.

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for request flow and [docs/DATA_SOURCES.md](./docs/DATA_SOURCES.md) for source status and coverage limits.

## Cloudflare deployment outline

The intended topology is Cloudflare Pages for the static export and separate preview and production Cloudflare Workers for the API. Create and verify the authorized Pages project and Worker environments before deployment; this repository's previous resource audit found no Wandr project or target custom domains in the authenticated account.

1. From the repository root, set `GEOAPIFY_API_KEY` with `npm exec --workspace @wandr/api -- wrangler secret put GEOAPIFY_API_KEY --env preview`, then deploy with `npm exec --workspace @wandr/api -- wrangler deploy --env preview`. Set the preview's exact `ALLOWED_ORIGINS` first.
2. Build the static web app with `NEXT_PUBLIC_API_BASE_URL` set to the preview API HTTPS URL, then deploy the contents of `apps/web/out` to a separate Pages preview.
3. Verify a genuine provider-backed overseas/local place search and a route on preview, API CORS, attribution, secret isolation, and error behavior.
4. Only after gates pass, configure the authorized `wandr.ricky.network` Pages domain and separate `api.wandr.ricky.network` Worker domain (or an approved HTTPS Worker URL). Confirm current DNS and ownership; do not modify unrelated records.
5. Deploy the production Worker and Pages build with production URLs and exact production CORS origins, then repeat real-provider end-to-end checks over HTTPS.

Cloudflare access alone is not evidence of a deployment. Never promote production while real provider credentials, an authorized staging origin, or the verified passenger-transport comparison gate is unavailable. The detailed blockers and A01–A40 acceptance record are in [docs/TEST_REPORT.md](./docs/TEST_REPORT.md).
