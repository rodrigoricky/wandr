import { expect, test } from "@playwright/test";

declare global {
  interface Window { __gpsRequestCount: number }
}

const origin = { id: "test-city-hall", label: "Davao City Hall, Davao City", addressLine: "Davao City Hall, Davao City", city: "Davao City", country: "Philippines", countryCode: "PH", coordinates: { lat: 7.064, lon: 125.608 } };
const destination = { id: "test-matina", label: "Matina Town Square, Davao City", addressLine: "Matina Town Square, Davao City", city: "Davao City", country: "Philippines", countryCode: "PH", coordinates: { lat: 7.05, lon: 125.595 } };
const line = { type: "LineString" as const, coordinates: [[125.608, 7.064], [125.602, 7.057], [125.595, 7.05]] as [number, number][] };

test("manual search, keyboard place selection, sorting, details, and back navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const submitted: unknown[] = [];
  const mapFitWarnings: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "warning" && message.text().includes("Map cannot fit within canvas")) mapFitWarnings.push(message.text());
  });
  await page.route("**/v1/places/search**", async (route) => {
    const query = new URL(route.request().url()).searchParams.get("q")?.toLowerCase() ?? "";
    const place = query.includes("hall") ? origin : destination;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ places: [place] }) });
  });
  await page.route("**/v1/trips/compare", async (route) => {
    submitted.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      origin, destination, generatedAt: "2026-11-07T00:00:00.000Z", scope: "davao_city", journeyType: "local", airports: null, airRoute: null,
      warnings: [],
      options: [
        { id: "demo-jeepney", title: "Jeepney", mode: "jeepney", providerId: "jeepney", legs: [{ mode: "drive", title: "Road-distance reference", distanceMeters: 2400, durationSeconds: 480, geometry: line, steps: [], source: "Geoapify Routing" }], fare: { currency: "PHP", min: 20, max: 20, status: "estimated", sourceName: "Demo fare model", sourceUrl: null, checkedAt: null }, totalDurationSeconds: 1_000, totalWalkingMeters: 0, transfers: null, availability: "estimated_demo", estimate: { kind: "demo_model", modelId: "jeepney-demo", version: "1", basis: "Demo fare input", note: "Conditional estimate only; no stops or boarding directions." }, note: "Conditional fare reference only.", rankingEligible: { cheapest: true, fastest: true } },
        { id: "demo-taxi", title: "Grab Taxi", mode: "taxi", providerId: "grab_taxi", legs: [{ mode: "drive", title: "Road-distance reference", distanceMeters: 2400, durationSeconds: 480, geometry: line, steps: [], source: "Geoapify Routing" }], fare: { currency: "PHP", min: 80, max: 100, status: "estimated", sourceName: "Demo fare model", sourceUrl: null, checkedAt: null }, totalDurationSeconds: 700, totalWalkingMeters: 0, transfers: null, availability: "estimated_demo", estimate: { kind: "demo_model", modelId: "taxi-demo", version: "1", basis: "Demo fare input", note: "Road geometry is a distance reference only; no provider quote or vehicle availability is verified." }, note: "Road geometry is a distance reference only.", rankingEligible: { cheapest: true, fastest: true } },
        { id: "demo-car", title: "Green GSM Taxi", mode: "taxi", providerId: "green_gsm_taxi", legs: [{ mode: "drive", title: "Road-distance reference", distanceMeters: 2400, durationSeconds: 480, geometry: line, steps: [], source: "Geoapify Routing" }], fare: { currency: "PHP", min: 100, max: 120, status: "estimated", sourceName: "Demo fare model", sourceUrl: null, checkedAt: null }, totalDurationSeconds: 800, totalWalkingMeters: 0, transfers: null, availability: "estimated_demo", estimate: { kind: "demo_model", modelId: "car-demo", version: "1", basis: "Demo fare input", note: "No provider quote or vehicle availability is verified." }, note: "Road geometry is a distance reference only.", rankingEligible: { cheapest: true, fastest: true } },
        { id: "demo-motorcycle", title: "Maxim Motorcycle", mode: "motorcycle", providerId: "maxim_motorcycle", legs: [{ mode: "drive", title: "Road-distance reference", distanceMeters: 2400, durationSeconds: 480, geometry: line, steps: [], source: "Geoapify Routing" }], fare: { currency: "PHP", min: 40, max: 60, status: "estimated", sourceName: "Demo fare model", sourceUrl: null, checkedAt: null }, totalDurationSeconds: 600, totalWalkingMeters: 0, transfers: null, availability: "estimated_demo", estimate: { kind: "demo_model", modelId: "motor-demo", version: "1", basis: "Demo fare input", note: "No provider quote or vehicle availability is verified." }, note: "Road geometry is a distance reference only.", rankingEligible: { cheapest: true, fastest: true } },
      ],
    }) });
  });

  await page.goto("/");
  await expect(page.getByRole("link", { name: /OpenStreetMap/ })).toBeVisible({ timeout: 15_000 });
  await page.locator('.route-map[data-map-ready="true"]').waitFor({ state: "visible", timeout: 20_000 });
  await page.screenshot({ path: "/tmp/wandr-search-390.png", fullPage: true });
  await page.getByRole("button", { name: /Choose starting point/ }).click();
  const originSearch = page.getByRole("combobox", { name: "Starting point place search" });
  await originSearch.fill("City Hall");
  await expect(page.getByRole("option")).toHaveCount(1);
  await originSearch.press("ArrowDown");
  await originSearch.press("Enter");

  await page.getByRole("button", { name: "Choose destination" }).click();
  const destinationSearch = page.getByRole("combobox", { name: "Destination place search" });
  await destinationSearch.fill("Matina Town Square");
  await expect(page.getByRole("option")).toHaveCount(1);
  await page.getByRole("option").click();

  await expect(page.getByRole("button", { name: "Find routes" })).toBeEnabled();
  await page.getByRole("button", { name: "Swap origin and destination" }).click();
  await expect(page.getByRole("button", { name: /Choose starting point, Matina Town Square/ })).toBeVisible();
  await page.getByRole("button", { name: "Swap origin and destination" }).click();
  await page.getByRole("button", { name: "Find routes" }).click();

  await expect(page.getByRole("heading", { name: "Route options" })).toBeVisible();
  for (const providerId of ["grab_taxi", "green_gsm_taxi", "maxim_motorcycle", "jeepney"]) {
    await expect(page.locator(`.option-card[data-provider-id="${providerId}"]`)).toHaveCount(1);
  }
  await expect(page.getByText("Grab Taxi", { exact: true })).toBeVisible();
  await expect(page.getByText("Green GSM Taxi", { exact: true })).toBeVisible();
  await expect(page.getByText("Maxim Motorcycle", { exact: true })).toBeVisible();
  await expect(page.getByText("Jeepney", { exact: true })).toBeVisible();
  await expect(page.getByText("Car ride estimate", { exact: true })).toHaveCount(0);
  await expect.poll(() => page.locator('.option-card[data-provider-id="grab_taxi"] img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await expect.poll(() => page.locator('.option-card[data-provider-id="green_gsm_taxi"] img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await expect.poll(() => page.locator('.option-card[data-provider-id="maxim_motorcycle"] img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  expect(await page.locator('.option-card[data-provider-id="grab_taxi"]').evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgb(234, 246, 237)");
  expect(await page.locator('.option-card[data-provider-id="green_gsm_taxi"]').evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgb(231, 245, 242)");
  expect(await page.locator('.option-card[data-provider-id="maxim_motorcycle"]').evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgb(255, 240, 240)");
  expect(await page.locator('.option-card[data-provider-id="jeepney"]').evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgb(255, 255, 255)");
  await expect.poll(() => mapFitWarnings).toHaveLength(0);
  for (const [width, height] of [[320, 700], [375, 812], [390, 844], [430, 932], [768, 1024], [1280, 800], [844, 390]] as const) {
    await page.setViewportSize({ width, height });
    await page.getByRole("heading", { name: "Route options" }).waitFor();
    await page.screenshot({ path: `/tmp/wandr-demo-results-${width}x${height}.png` });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: /₱/ }).first()).toBeVisible();
  await expect(page.getByText("Fare comparison unavailable.")).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 568 });
  const beforeScroll = await page.evaluate(() => ({
    mode: document.querySelector(".mode-toggle")?.getBoundingClientRect().toJSON(),
    summary: document.querySelector(".trip-summary")?.getBoundingClientRect().toJSON(),
  }));
  const scrollResult = await page.locator(".option-list-scroll").evaluate((element) => {
    const list = element as HTMLElement;
    list.scrollTop = list.scrollHeight;
    return { scrollTop: list.scrollTop, scrollHeight: list.scrollHeight, clientHeight: list.clientHeight };
  });
  expect(scrollResult.scrollTop).toBeGreaterThan(0);
  expect(scrollResult.scrollHeight).toBeGreaterThan(scrollResult.clientHeight);
  const afterScroll = await page.evaluate(() => ({
    mode: document.querySelector(".mode-toggle")?.getBoundingClientRect().toJSON(),
    summary: document.querySelector(".trip-summary")?.getBoundingClientRect().toJSON(),
  }));
  expect(afterScroll).toEqual(beforeScroll);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Get there faster" }).click();
  await expect(page.getByRole("button", { name: "Get there faster" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".option-badge")).toHaveCount(1);
  await page.getByRole("button", { name: /Grab Taxi/ }).click();
  await expect(page.getByRole("heading", { name: "Journey details" })).toBeVisible();
  await expect(page.getByText("Grab Taxi", { exact: true })).toBeVisible();
  await expect(page.getByText("₱80–₱100", { exact: true })).toBeVisible();
  await expect(page.locator(".detail-metrics > div")).toHaveCount(3);
  await expect(page.locator(".journey-breakdown > li")).toHaveCount(2);
  await expect(page.getByText("Source and estimate limits", { exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 568 });
  const metricRects = await page.locator(".detail-metrics > div").evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    return { top: rect.top, left: rect.left, right: rect.right, scrollWidth: (element as HTMLElement).scrollWidth, clientWidth: (element as HTMLElement).clientWidth };
  }));
  expect(metricRects).toHaveLength(3);
  expect(new Set(metricRects.map((metric) => metric.top)).size).toBe(1);
  expect(metricRects.every((metric) => metric.scrollWidth <= metric.clientWidth)).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByText(/Head northeast on the mapped road/)).toHaveCount(0);
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Route options" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Get there faster/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /Grab Taxi/ }).click();
  await expect(page.getByRole("heading", { name: "Journey details" })).toBeVisible();
  await page.getByRole("button", { name: "Back to comparison" }).click();
  await expect(page.getByRole("heading", { name: "Route options" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Get there faster" })).toHaveAttribute("aria-pressed", "true");
  expect(submitted).toHaveLength(1);
  expect(submitted[0]).toMatchObject({ origin: { id: origin.id }, destination: { id: destination.id } });
});

test("AdDU Jacinto starts the demo and the campus action never calls GPS or reverse geocoding", async ({ page, context }) => {
  await context.grantPermissions([]);
  const cityHall = { id: "city-hall", label: "Davao City Hall", addressLine: "Davao City, Philippines", city: "Davao City", country: "Philippines", countryCode: "PH", coordinates: { lat: 7.064, lon: 125.608 } };
  const mall = { id: "sm-davao", label: "SM City Davao", addressLine: "Quimpo Boulevard, Davao City, Philippines", city: "Davao City", country: "Philippines", countryCode: "PH", coordinates: { lat: 7.04875, lon: 125.5888 } };
  let reverseRequests = 0;
  await page.route("**/v1/places/search**", async (route) => {
    const query = new URL(route.request().url()).searchParams.get("q")?.toLowerCase() ?? "";
    await route.fulfill({ json: { places: [query.includes("hall") ? cityHall : mall] } });
  });
  page.on("request", (request) => { if (request.url().includes("/v1/places/reverse")) reverseRequests += 1; });
  await page.addInitScript(() => {
    const geo = navigator.geolocation;
    const requestPosition = geo.getCurrentPosition.bind(geo);
    window.__gpsRequestCount = 0;
    geo.getCurrentPosition = (...args) => {
      window.__gpsRequestCount += 1;
      requestPosition(...args);
    };
  });
  await page.goto("/");
  expect(await page.evaluate(() => window.__gpsRequestCount)).toBe(0);
  await expect(page.getByRole("button", { name: /Choose starting point, Ateneo de Davao University — Jacinto\/Main Campus/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Choose destination" })).toBeVisible();
  await page.locator('.route-map[data-map-ready="true"]').waitFor({ state: "visible", timeout: 20_000 });
  await expect(page.locator(".map-marker-origin")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Find routes" })).toBeDisabled();
  await page.getByRole("button", { name: /Choose starting point/ }).click();
  await page.getByRole("combobox", { name: "Starting point place search" }).fill("City Hall");
  await page.getByRole("option").click();
  await page.getByRole("button", { name: "Choose destination" }).click();
  await page.getByRole("combobox", { name: "Destination place search" }).fill("SM City Davao");
  await page.getByRole("option").click();
  await page.getByRole("button", { name: "Use AdDU Jacinto" }).click();
  await expect(page.getByRole("button", { name: /Choose starting point, Ateneo de Davao University — Jacinto\/Main Campus/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Choose destination, SM City Davao/ })).toBeVisible();
  expect(await page.evaluate(() => window.__gpsRequestCount)).toBe(0);
  expect(reverseRequests).toBe(0);
});

test("reviewed local Davao aliases appear immediately and merge with provider results", async ({ page }) => {
  let releaseProviderSearch: (() => void) | undefined;
  await page.route("**/v1/places/search**", async (route) => {
    await new Promise<void>((resolve) => { releaseProviderSearch = resolve; });
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ places: [
      { id: "provider-abreeza", label: "Abreeza Ayala Mall Davao", addressLine: "J. P. Laurel Avenue, Davao City, Philippines", category: "commercial.shopping_mall", source: "Geoapify", confidence: null, coordinates: { lon: 125.611561, lat: 7.0912032 } },
      { id: "provider-other", label: "Abreeza Parking", addressLine: "Davao City, Philippines", category: "parking", source: "Geoapify", confidence: null, coordinates: { lon: 125.612, lat: 7.091 } },
    ] }) });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /Choose starting point/ }).click();
  const input = page.getByRole("combobox", { name: "Starting point place search" });
  await input.fill("Abreeza Mall");
  const localResult = page.getByRole("option", { name: /Abreeza Ayala Mall Davao/ });
  await expect.poll(() => Boolean(releaseProviderSearch)).toBe(true);
  await expect(localResult).toBeEnabled();
  await expect(localResult).toBeVisible();
  await expect(page.getByRole("option")).toHaveCount(1);
  releaseProviderSearch?.();
  await expect(page.getByRole("option", { name: /Abreeza Parking/ })).toBeVisible({ timeout: 8_000 });
  await expect(page.getByRole("option")).toHaveCount(2);
  await localResult.click();
  await expect(page.getByRole("button", { name: /Choose starting point, Abreeza Ayala Mall Davao/ })).toBeVisible();
});

test("global named places remain selectable and show a generic international air preview", async ({ page }) => {
  const tokyo = { id: "geoapify:tokyo-tower", label: "Tokyo Tower", addressLine: "Minato City, Tokyo, Japan", city: "Tokyo", country: "Japan", countryCode: "JP", category: "tourism.attraction", source: "Geoapify", confidence: 0.99, coordinates: { lat: 35.6586, lon: 139.7454 } };
  const eiffel = { id: "geoapify:eiffel-tower", label: "Eiffel Tower", addressLine: "Champ de Mars, Paris, France", city: "Paris", country: "France", countryCode: "FR", category: "tourism.attraction", source: "Geoapify", confidence: 0.99, coordinates: { lat: 48.8584, lon: 2.2945 } };
  const airports = {
    origin: { iata: "CDG", name: "Charles de Gaulle International Airport", coordinates: { lat: 49.0097, lon: 2.5479 }, countryCode: "FR", municipality: "Paris", type: "large_airport", region: "FR-IDF" },
    destination: { iata: "HND", name: "Tokyo Haneda International Airport", coordinates: { lat: 35.5494, lon: 139.7798 }, countryCode: "JP", municipality: "Tokyo", type: "large_airport", region: "JP-13" },
  };
  const corridor = { type: "LineString", coordinates: Array.from({ length: 21 }, (_, index) => [airports.origin.coordinates.lon + (airports.destination.coordinates.lon - airports.origin.coordinates.lon) * index / 20, airports.origin.coordinates.lat + (airports.destination.coordinates.lat - airports.origin.coordinates.lat) * index / 20]) };
  await page.route("**/v1/places/search**", async (route) => {
    const query = new URL(route.request().url()).searchParams.get("q")?.toLowerCase() ?? "";
    const result = query.includes("eiffel") ? eiffel : tokyo;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ places: [result] }) });
  });
  await page.route("**/v1/trips/compare", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
    origin: eiffel, destination: tokyo, generatedAt: "2026-11-08T00:00:00.000Z", scope: "international", journeyType: "international", airports,
    airRoute: { geometry: corridor, distanceMeters: 9_700_000, durationSeconds: 50_000, source: "great_circle_preview", note: "Schematic preview" }, warnings: [],
    options: [{ id: "air-generic_air", title: "Air journey estimate", mode: "flight", providerId: "generic_air", legs: [{ mode: "flight", title: "Geographic air corridor", distanceMeters: 9_700_000, durationSeconds: 50_000, geometry: corridor, steps: [], source: "Wandr great-circle preview" }], fare: { currency: "PHP", min: 22_000, max: 30_000, status: "estimated", sourceName: "Wandr distance-based demo model", sourceUrl: null, checkedAt: null }, totalDurationSeconds: 50_000, totalWalkingMeters: 0, transfers: null, availability: "estimated_demo", estimate: { kind: "demo_model", modelId: "air-generic", version: "1", basis: "Great-circle distance", note: "Illustrative only; no airline, schedule, nonstop service, or availability is verified." }, note: "Geographic preview only", rankingEligible: { cheapest: true, fastest: true } }],
  }) }));
  await page.goto("/");
  await page.getByRole("button", { name: /Choose starting point/ }).click();
  const originSearch = page.getByRole("combobox", { name: "Starting point place search" });
  await originSearch.fill("Eiffel Tower");
  await expect(page.getByRole("option")).toContainText(/Eiffel Tower.*Champ de Mars, Paris, France/);
  await originSearch.press("Enter");
  await page.getByRole("button", { name: "Choose destination" }).click();
  const destinationSearch = page.getByRole("combobox", { name: "Destination place search" });
  await destinationSearch.fill("Tokyo Tower");
  await expect(page.getByRole("option")).toContainText(/Tokyo Tower.*Minato City, Tokyo, Japan/);
  await destinationSearch.press("Enter");
  await page.getByRole("button", { name: "Find routes" }).click();
  await expect(page.getByRole("button", { name: /Air journey/ })).toBeVisible();
  await expect(page.locator(".route-map")).toHaveAttribute("data-route-kind", "air");
  await expect(page.locator(".map-marker-airport")).toHaveCount(2);
  await expect(page.locator(".map-aircraft-marker")).toBeVisible();
  await page.setViewportSize({ width: 320, height: 700 });
  const airfare = page.locator(".option-card-flight .option-fare strong").first();
  await expect(airfare).toBeVisible();
  await expect.poll(() => airfare.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await expect.poll(() => page.evaluate(() => {
    const map = document.querySelector(".route-map")?.getBoundingClientRect();
    const markers = [...document.querySelectorAll(".map-marker-airport")].map((element) => element.getBoundingClientRect());
    const sheet = document.querySelector(".sheet-results")?.getBoundingClientRect();
    const attribution = document.querySelector(".maplibregl-ctrl-attrib")?.getBoundingClientRect();
    const navigation = document.querySelector(".maplibregl-ctrl-top-right")?.getBoundingClientRect();
    const clearOf = (marker: DOMRect, control: DOMRect) => marker.right <= control.left || marker.left >= control.right || marker.bottom <= control.top || marker.top >= control.bottom;
    const fits = Boolean(map && sheet && attribution && markers.length === 2 && markers.every((marker) => marker.left >= map.left && marker.right <= map.right
      && marker.top >= map.top && marker.bottom <= sheet.top
      && clearOf(marker, attribution) && (!navigation || clearOf(marker, navigation))));
    return JSON.stringify({ fits, map: map?.toJSON(), markers: markers.map((marker) => marker.toJSON()), sheet: sheet?.toJSON(), attribution: attribution?.toJSON(), navigation: navigation?.toJSON() });
  }), { timeout: 10_000 }).toContain('"fits":true');
  await page.screenshot({ path: "/tmp/wandr-demo-air-320x700.png" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole("button", { name: /Air journey/ }).click();
  await expect(page.getByRole("heading", { name: "Journey details" })).toBeVisible();
  const detailRegion = page.getByRole("region", { name: "Route details" });
  await expect(detailRegion.getByText("CDG", { exact: true })).toBeVisible();
  await expect(detailRegion.getByText("HND", { exact: true })).toBeVisible();
  await expect(detailRegion.locator(".journey-breakdown > li")).toHaveCount(2);
  await page.getByRole("button", { name: "Back to comparison" }).click();
  await page.getByRole("button", { name: "Edit trip" }).click();
  await expect(page.getByRole("button", { name: /Choose starting point, Eiffel Tower/ })).toBeVisible();
});

test("Davao to Tokyo shows both airline identities, codes, estimates, and tied ETAs honestly", async ({ page }) => {
  const origin = { id: "davao-city-hall", label: "Davao City Hall", addressLine: "Davao City, Philippines", city: "Davao City", country: "Philippines", countryCode: "PH", coordinates: { lat: 7.064, lon: 125.608 } };
  const destination = { id: "tokyo-tower", label: "Tokyo Tower", addressLine: "Minato City, Tokyo, Japan", city: "Tokyo", country: "Japan", countryCode: "JP", coordinates: { lat: 35.6586, lon: 139.7454 } };
  const airports = {
    origin: { iata: "DVO", name: "Francisco Bangoy International Airport", coordinates: { lat: 7.1255, lon: 125.6458 }, countryCode: "PH", municipality: "Davao", type: "large_airport", region: "PH-11" },
    destination: { iata: "HND", name: "Tokyo Haneda International Airport", coordinates: { lat: 35.5494, lon: 139.7798 }, countryCode: "JP", municipality: "Tokyo", type: "large_airport", region: "JP-13" },
  };
  const corridor = { type: "LineString", coordinates: Array.from({ length: 21 }, (_, index) => [airports.origin.coordinates.lon + (airports.destination.coordinates.lon - airports.origin.coordinates.lon) * index / 20, airports.origin.coordinates.lat + (airports.destination.coordinates.lat - airports.origin.coordinates.lat) * index / 20]) };
  const airline = (providerId: "philippine_airlines" | "cebu_pacific", min: number, max: number) => ({
    id: `air-${providerId}`, title: providerId === "philippine_airlines" ? "Philippine Airlines" : "Cebu Pacific", mode: "flight", providerId,
    legs: [{ mode: "flight", title: "Geographic air corridor", distanceMeters: 3_400_000, durationSeconds: 28_800, geometry: corridor, steps: [], source: "Wandr great-circle preview" }],
    fare: { currency: "PHP", min, max, status: "estimated", sourceName: "Wandr distance-based demo model", sourceUrl: null, checkedAt: null },
    totalDurationSeconds: 28_800, totalWalkingMeters: 0, transfers: null, availability: "estimated_demo",
    estimate: { kind: "demo_model", modelId: `air-${providerId}`, version: "1", basis: "Great-circle distance", note: "No carrier quote or schedule is supplied." }, note: null,
    rankingEligible: { cheapest: true, fastest: true },
  });
  await page.route("**/v1/places/search**", async (route) => {
    const query = new URL(route.request().url()).searchParams.get("q")?.toLowerCase() ?? "";
    await route.fulfill({ json: { places: [query.includes("tokyo") ? destination : origin] } });
  });
  await page.route("**/v1/trips/compare", async (route) => route.fulfill({ json: {
    origin, destination, generatedAt: "2026-11-08T00:00:00.000Z", scope: "international", journeyType: "international", airports,
    airRoute: { geometry: corridor, distanceMeters: 3_400_000, durationSeconds: 28_800, source: "great_circle_preview", note: "Schematic corridor." },
    options: [airline("philippine_airlines", 12_300, 19_600), airline("cebu_pacific", 18_500, 24_000)], warnings: [],
  } }));
  await page.goto("/");
  await page.getByRole("button", { name: /Choose starting point/ }).click();
  await page.getByRole("combobox", { name: "Starting point place search" }).fill("Davao City Hall");
  await page.getByRole("option").click();
  await page.getByRole("button", { name: "Choose destination" }).click();
  await page.getByRole("combobox", { name: "Destination place search" }).fill("Tokyo Tower");
  await page.getByRole("option").click();
  await page.getByRole("button", { name: "Find routes" }).click();
  await expect(page.locator('.option-card[data-provider-id="philippine_airlines"]')).toHaveCount(1);
  await expect(page.locator('.option-card[data-provider-id="cebu_pacific"]')).toHaveCount(1);
  await expect(page.locator(".option-card-subtitle")).toHaveText(["DVO → HND", "DVO → HND"]);
  expect(await page.locator('.option-card[data-provider-id="philippine_airlines"]').evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgb(255, 241, 239)");
  expect(await page.locator('.option-card[data-provider-id="cebu_pacific"]').evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgb(255, 246, 228)");
  for (const providerId of ["philippine_airlines", "cebu_pacific"]) {
    await expect.poll(() => page.locator(`.option-card[data-provider-id="${providerId}"] img`).evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  }
  await expect(page.getByText(/reference estimate/i)).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.screenshot({ path: "/tmp/wandr-air-results-320x568.png" });
  await page.getByRole("button", { name: "Get there faster" }).click();
  await expect(page.locator(".option-badge")).toHaveCount(0);
  await expect(page.locator(".route-map")).toHaveAttribute("data-route-kind", "air");
  await expect(page.locator(".map-marker-airport")).toHaveCount(2);
  await page.locator('.option-card[data-provider-id="philippine_airlines"]').click();
  await expect(page.locator(".details-heading .provider-identity")).toContainText("Philippine Airlines");
  await expect(page.locator(".detail-metrics > div")).toHaveCount(3);
  await expect(page.locator(".journey-breakdown > li")).toHaveCount(2);
  await expect(page.getByText("Departure", { exact: true })).toBeVisible();
  await expect(page.getByText("Arrival", { exact: true })).toBeVisible();
  await expect(page.getByText("Geographic air corridor", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: "/tmp/wandr-air-details-320x568.png" });
  const tiles = await page.locator(".detail-metrics > div").evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().top));
  expect(new Set(tiles).size).toBe(1);
  await expect(page.locator(".detail-metrics strong").first()).toHaveAttribute("aria-label", "₱12,300–₱19,600");
});

test("an unresolved airport pair shows one recoverable message and keeps selected places", async ({ page }) => {
  const origin = { id: "remote-origin", label: "Remote Antarctic Field Site", city: null, country: "Antarctica", countryCode: "AQ", coordinates: { lat: -75, lon: 0 } };
  const destination = { id: "remote-destination", label: "Remote South Pole Site", city: null, country: "Antarctica", countryCode: "AQ", coordinates: { lat: -80, lon: 45 } };
  await page.route("**/v1/places/search**", async (route) => {
    const query = new URL(route.request().url()).searchParams.get("q")?.toLowerCase() ?? "";
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ places: [query.includes("field") ? origin : destination] }) });
  });
  await page.route("**/v1/trips/compare", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
    origin, destination, generatedAt: "2026-11-08T00:00:00.000Z", scope: "domestic_long_distance", journeyType: "domestic_long_distance",
    airports: null, airRoute: null, options: [], warnings: ["A suitable scheduled-service airport could not be resolved near both selected places."],
  }) }));
  await page.goto("/");
  await page.getByRole("button", { name: /Choose starting point/ }).click();
  const from = page.getByRole("combobox", { name: "Starting point place search" });
  await from.fill("Remote Antarctic Field Site");
  await expect(page.getByRole("option")).toHaveCount(1);
  await from.press("Enter");
  await page.getByRole("button", { name: "Choose destination" }).click();
  const to = page.getByRole("combobox", { name: "Destination place search" });
  await to.fill("Remote South Pole Site");
  await expect(page.getByRole("option")).toHaveCount(1);
  await to.press("Enter");
  await page.getByRole("button", { name: "Find routes" }).click();
  await expect(page.getByText("A suitable scheduled-service airport could not be resolved near both selected places.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Philippine Airlines|Cebu Pacific/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Edit trip" }).click();
  await expect(page.getByRole("button", { name: /Choose starting point, Remote Antarctic Field Site/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Choose destination, Remote South Pole Site/ })).toBeVisible();
});

test("required viewport widths keep the app inside its viewport and desktop uses the phone frame", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /OpenStreetMap/ })).toBeVisible({ timeout: 15_000 });
  const viewports = [[320, 568], [360, 640], [375, 667], [390, 844], [414, 896], [430, 932], [600, 820], [768, 1024], [1024, 768], [1280, 800], [1440, 900], [844, 390], [932, 430]] as const;
  for (const [width, height] of viewports) {
    await page.setViewportSize({ width, height });
    await expect(page.getByRole("link", { name: /OpenStreetMap/ })).toBeVisible();
    const metrics = await page.evaluate(() => {
      const frame = document.querySelector(".device-frame");
      if (!frame) throw new Error("phone shell is missing");
      const bounds = frame.getBoundingClientRect();
      return { viewport: window.innerWidth, document: document.documentElement.scrollWidth, frame: bounds.width, border: getComputedStyle(frame).borderWidth };
    });
    expect(metrics.document, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(metrics.viewport);
    if (width < 600) expect(metrics.frame).toBe(width);
    if (width >= 600) expect(metrics.frame).toBeLessThanOrEqual(430);
  }
});
