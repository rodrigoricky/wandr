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

`npm run build:web` is the deployment build and requires `NEXT_PUBLIC_API_BASE_URL` to be set to the target HTTPS Worker URL. `npm run build:web:local` is a static-export check that explicitly embeds the local Worker URL. Playwright browser tests intercept the API with deterministic test fixtures; they do not prove Geoapify connectivity or deployed behavior. The live staging and production integration checks are recorded in [docs/TEST_REPORT.md](./docs/TEST_REPORT.md).

## Architecture and behavior

- `apps/web` is a Next.js static export served from `apps/web/out`. It uses one persistent MapLibre map beneath the search, results, and route-detail sheets.
- `apps/api` is a Cloudflare Worker. It validates request data, restricts CORS to configured origins, rate limits search/compare requests, and owns Geoapify calls and the provider secret.
- `packages/shared` holds the API contract and geographic normalization.
- Worldwide place lookup is separate from transport coverage. Places outside the current approximate Davao coverage return an explicit unsupported-journey response.
- Walking is only included in standard comparisons if its provider route is at most 1.5 km and 25 minutes. A road driving duration is shown as an estimate, but cannot win “Get there faster” because it is not a complete passenger journey. Unknown fares are not ranked as cheap.
- Map tiles come from OpenFreeMap's Positron style; attribution remains visible. Place and route provider attributions are shown where required.

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for request flow and [docs/DATA_SOURCES.md](./docs/DATA_SOURCES.md) for source status and coverage limits.

## Cloudflare deployment outline

The live topology is Cloudflare Pages for the static export and separate preview and production Cloudflare Workers for the API. Production is at [wandr.ricky.network](https://wandr.ricky.network); its API is at [api.wandr.ricky.network](https://api.wandr.ricky.network/v1/health). The preview is at [codex-wandr-full-correction.wandr-ld1.pages.dev](https://codex-wandr-full-correction.wandr-ld1.pages.dev) and uses the `wandr-api-preview` Worker. The production Geoapify key is stored only as a Worker secret. See [docs/TEST_REPORT.md](./docs/TEST_REPORT.md) for actual provider checks and remaining gates.

1. From the repository root, set the preview Worker secret with `npm exec --workspace @wandr/api -- wrangler secret put GEOAPIFY_API_KEY --env preview` and deploy with `npm exec --workspace @wandr/api -- wrangler deploy --env preview`.
2. Build the static app with `NEXT_PUBLIC_API_BASE_URL` set to the preview API HTTPS URL, then deploy `apps/web/out` to the `wandr` Pages project on a non-production branch.
3. Verify genuine provider-backed local/overseas place searches and a local route on preview, plus CORS, attribution, secret isolation, and error behavior.
4. Configure the Pages domain `wandr.ricky.network` and Worker custom domain `api.wandr.ricky.network`; verify DNS and HTTPS.
5. Set the production Worker secret, deploy the production Worker, build with `NEXT_PUBLIC_API_BASE_URL=https://api.wandr.ricky.network`, and deploy the static output on the Pages production branch. Repeat real-provider end-to-end checks over HTTPS.

Cloudflare access alone is not evidence of a deployment. Production has passed live place search and route checks, but the product remains a Davao walking/road-estimate prototype until current passenger-transit routes and fares are verified. The detailed evidence and A01–A40 acceptance record are in [docs/TEST_REPORT.md](./docs/TEST_REPORT.md).
