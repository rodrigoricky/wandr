# Wandr

Wandr is a map-first transportation comparison demonstration. It keeps the existing two-location search, optional GPS, worldwide Geoapify search, map-first phone shell, and two result sort controls. Local Davao results combine real walking/road geometry with clearly labeled, deterministic demo-price estimates. International or domestic-long-distance comparisons use nearby scheduled-service airport records and a schematic great-circle air corridor.

Wandr does not provide live taxi/ride-hailing quotes, company service checks, verified jeepney stops, boarding directions, airline schedules, bookings or seat availability. `Est.` amounts are model outputs. The displayed road line is not a passenger-transit route; the airport line is not a flight track or nonstop-service claim.

## Requirements and local development

- Node.js 22+ and npm 10+
- A Geoapify API key for live search and local routing
- Cloudflare access for preview/production deployment

```sh
npm ci
cp apps/api/.dev.vars.example apps/api/.dev.vars
```

Add the key only to ignored `apps/api/.dev.vars`. Do not put it in `NEXT_PUBLIC_*`, tracked source, or the static bundle. Run the Worker and web app in separate terminals:

```sh
npm run dev:api
npm run dev:web
```

The web app runs at `http://localhost:3000`; the Worker uses `http://localhost:8787`. If the port is occupied, run Wrangler on another local port and set `NEXT_PUBLIC_API_BASE_URL` for the web build.

## Checks

```sh
npm run check
npm run test:e2e
npm audit
npm run deploy:dry-run -w @wandr/api
```

`npm run check` runs strict TypeScript, ESLint, all unit tests, and a local static export. `npm run build:web` is the deploy build and requires `NEXT_PUBLIC_API_BASE_URL` to be the target HTTPS Worker URL. Playwright fixtures exercise UI behavior but do not prove Geoapify reachability; see [the live verification report](./docs/TEST_REPORT.md).

The airport directory can be regenerated from its pinned public-domain OurAirports source revision:

```sh
node apps/api/scripts/generate-airport-index.mjs
```

## Estimate model

- The Worker requests live Geoapify pedestrian and driving routes for local Davao trips. Walk is a default option only up to 1.5 km and 25 minutes.
- Taxi estimates use the reported September 2026 regular taxi tariff as a distance/time input to an explicitly labeled road estimate. Car and motorcycle values use documented demo coefficients. Jeepney estimates apply the reported traditional PUJ fare rule to a road-distance input only; no stop, boarding route or ride distance is implied.
- International and domestic-long-distance results resolve nearby scheduled-service airports from the Worker-only compact directory. PAL/Cebu estimates appear only for a pair involving the Philippines; otherwise the reference provider is generic. No brand logo is included where reuse permission is unconfirmed.

Detailed architecture and source boundaries are in [ARCHITECTURE.md](./docs/ARCHITECTURE.md), [DATA_SOURCES.md](./docs/DATA_SOURCES.md) and [BRAND_ASSETS.md](./docs/BRAND_ASSETS.md).

## Deployment

Production is [wandr.ricky.network](https://wandr.ricky.network) and its API is [api.wandr.ricky.network](https://api.wandr.ricky.network/v1/health). The preview Pages alias is [codex-wandr-full-correction-k8pn.wandr-ld1.pages.dev](https://codex-wandr-full-correction-k8pn.wandr-ld1.pages.dev); it calls the separate `wandr-api-preview` Worker. Production and preview use separate Worker secrets. See [TEST_REPORT.md](./docs/TEST_REPORT.md) for the exact code revision, integration evidence, deployment identifiers and known limits.
