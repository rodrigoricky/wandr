# Data sources and evidence

| Data | Source | Status / claim boundary |
|---|---|---|
| Map style/tiles | [OpenFreeMap Positron](https://tiles.openfreemap.org/styles/positron); [OpenStreetMap attribution](https://www.openstreetmap.org/copyright) | Style URL returned HTTP 200 and rendered in the local browser; MapLibre attribution control is retained. Tiles are not route or fare evidence. |
| Place autocomplete/reverse geocoding | [Geoapify Geocoding API](https://apidocs.geoapify.com/docs/geocoding/) | Worker adapter implemented. Requests require `GEOAPIFY_API_KEY`; no key was present during implementation, so live place results have not been verified. |
| Walking and driving geometry | [Geoapify Routing API](https://apidocs.geoapify.com/docs/routing/) | Worker adapter implemented for `walk` and `drive`; actual request results have not been verified without a key. A driving route is not proof of taxi availability/fare. |
| Jeepney/tricycle/taxi/ride-hailing route, coverage, and fare data | None provided or independently verified | Dataset files are intentionally empty. Wandr does not return such options or fares. |
| Davao City boundary | None provided | A broad approximate coordinate box is used for basic rejection. It is not an authoritative boundary and is documented in the UI/API. |

No route/fare record currently has a source citation or verification date because no such records have been researched and accepted. Do not infer transport service from map tiles or a road-routing response.
