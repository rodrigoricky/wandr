# Implementation status

Updated 2026-11-08 for the demo transportation correction.

## Phase gates

| Gate | Status | Evidence and boundary |
|---|---|---|
| A. Audit and baseline | **PASS** | Read the project guidance, source, tests, configuration and current reports; `npm ci`, original check suite, all 9 original Playwright tests, `npm audit`, live production health and Davao road-route comparison passed before edits. Root `a.md` was already untracked and remains untouched. |
| B. Shared contracts and estimate logic | **PASS** | Added typed journey classes, modes, provider IDs, airports, air geometry and model provenance; classification, fare/time functions, finite-number guards, stable sort and provider-name fallback have unit coverage. |
| C. Local demo comparisons | **PASS** | Real Geoapify walking/driving routes provide geometry/distance/time basis. Deterministic taxi, car and motorcycle estimates plus conditional jeepney reference are returned only for the local Davao demo. A long walk does not remove other choices. No provider coverage or boarding route is asserted. |
| D. Airport corridor | **PASS** | A reproducible generator pins a public-domain OurAirports source revision and produces a compact server-only directory. Country-scoped airport resolution, Davao/Tokyo, Davao/Cebu, Paris/Tokyo, no-airport behavior, sampled great-circle geometry and antimeridian splitting are covered. The corridor is schematic; no schedule, nonstop service or flight track is claimed. |
| E. Assets and interface | **PASS with text fallback** | Existing search/map/phone shell and two sort controls remain. Cards open details; map draws distinct dashed air and solid road sources. The jeepney is an original SVG. No corporate provider logos were shipped because reuse permission was not established; provider names use the specified text fallback. |
| F. Preview and production release | **PASS** | Preview and production Pages/Workers are deployed from `main` commit `1eb7f94`. All 53 unit tests and 10 Playwright tests pass; live Geoapify search/comparison, exact CORS, and production 320×700 browser checks passed. Deployment IDs and residual limits are in [TEST_REPORT.md](./TEST_REPORT.md). |

## Demo scope and current limits

- Local prices and times are deterministic `Est.` model outputs with model/version/source metadata. Taxi and PUJ references are based on the cited 2026 tariff report; the road-distance input is not a verified passenger journey. Car, motorcycle and air values are Wandr assumptions.
- PAL and Cebu Pacific are reference estimate labels for Philippines-related pairs, not claims of service or bookable fares. Unrelated international pairs get a generic air estimate. There are no official company logos in the bundle.
- Airport records are proximity candidates, not route/schedule evidence. If suitable airports cannot be resolved, the result retains places and shows one concise recoverable message.
- The official Davao Bus tracker has no documented public integration API/data-reuse permission in the reviewed project sources; no actual bus/jeepney route or boarding details are present.
- Automated browser coverage is not physical iOS/Android, GPS-permission grant, or device-network testing.

See [source boundaries](./DATA_SOURCES.md) and the [acceptance evidence matrix](./TEST_REPORT.md).
