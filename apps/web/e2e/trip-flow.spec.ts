import { expect, test } from "@playwright/test";

declare global {
  interface Window { __gpsRequestCount: number }
}

const origin = { id: "test-city-hall", label: "Davao City Hall, Davao City", addressLine: "Davao City Hall, Davao City", coordinates: { lat: 7.064, lon: 125.608 } };
const destination = { id: "test-matina", label: "Matina Town Square, Davao City", addressLine: "Matina Town Square, Davao City", coordinates: { lat: 7.05, lon: 125.595 } };
const line = { type: "LineString" as const, coordinates: [[125.608, 7.064], [125.602, 7.057], [125.595, 7.05]] as [number, number][] };

test("manual search, keyboard place selection, sorting, details, and back navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const submitted: unknown[] = [];
  await page.route("**/v1/places/search**", async (route) => {
    const query = new URL(route.request().url()).searchParams.get("q")?.toLowerCase() ?? "";
    const place = query.includes("hall") ? origin : destination;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ places: [place] }) });
  });
  await page.route("**/v1/trips/compare", async (route) => {
    submitted.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      origin, destination, generatedAt: "2026-11-07T00:00:00.000Z", scope: "davao_city",
      warnings: ["No verified Davao public-transport routes or fare rules are currently available.", "A walking route was found but is longer than Wandr’s short-walk comparison limit, so it is not shown as the default money-saving option."],
      options: [
        { id: "geoapify-drive", title: "Drive estimate", mode: "drive", legs: [{ mode: "drive", title: "Driving route estimate", distanceMeters: 2400, durationSeconds: 480, geometry: line, steps: [], source: "Geoapify Routing" }], fare: { currency: "PHP", min: null, max: null, status: "unknown", sourceName: null, sourceUrl: null, checkedAt: null }, totalDurationSeconds: 480, totalWalkingMeters: 0, transfers: 0, availability: "estimated_road_route", note: "Road driving duration only; availability and fare are unknown.", rankingEligible: { cheapest: false, fastest: false } },
      ],
    }) });
  });

  await page.goto("/");
  await expect(page.getByRole("link", { name: /OpenStreetMap/ })).toBeVisible({ timeout: 15_000 });
  await page.locator('.route-map[data-map-ready="true"]').waitFor({ state: "visible", timeout: 20_000 });
  await page.screenshot({ path: "/tmp/wandr-search-390.png", fullPage: true });
  await page.getByRole("button", { name: "Choose starting point" }).click();
  const originSearch = page.getByRole("combobox", { name: "Starting point place search" });
  await originSearch.fill("City Hall");
  await expect(page.getByRole("option")).toHaveCount(1);
  await originSearch.press("ArrowDown");
  await originSearch.press("Enter");

  await page.getByRole("button", { name: "Choose destination" }).click();
  const destinationSearch = page.getByRole("combobox", { name: "Destination place search" });
  await destinationSearch.fill("Matina");
  await expect(page.getByRole("option")).toHaveCount(1);
  await page.getByRole("option").click();

  await expect(page.getByRole("button", { name: "Find routes" })).toBeEnabled();
  await page.getByRole("button", { name: "Swap origin and destination" }).click();
  await expect(page.getByRole("button", { name: /Choose starting point, Matina Town Square/ })).toBeVisible();
  await page.getByRole("button", { name: "Swap origin and destination" }).click();
  await page.getByRole("button", { name: "Find routes" }).click();

  await expect(page.getByRole("heading", { name: "Route options" })).toBeVisible();
  await page.screenshot({ path: "/tmp/wandr-results-390.png", fullPage: true });
  await expect(page.getByText("No verified Davao public-transport routes or fare rules are currently available.")).toBeVisible();
  await page.getByRole("button", { name: "Get there faster" }).click();
  await expect(page.getByRole("button", { name: "Get there faster" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/longer than Wandr’s short-walk comparison limit/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Lowest supported fare|Shortest complete time/ })).toHaveCount(0);
  await page.getByRole("button", { name: "View route" }).click();
  await expect(page.getByRole("heading", { name: "Route details" })).toBeVisible();
  await expect(page.getByText("Fare unavailable")).toBeVisible();
  await page.getByRole("button", { name: "Back to route options" }).click();
  await expect(page.getByRole("heading", { name: "Route options" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Get there faster" })).toHaveAttribute("aria-pressed", "true");
  expect(submitted).toHaveLength(1);
  expect(submitted[0]).toMatchObject({ origin: { id: origin.id }, destination: { id: destination.id } });
});

test("GPS is opt-in and permission denial leaves manual search available", async ({ page, context }) => {
  await context.grantPermissions([]);
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
  await expect(page.getByRole("button", { name: "Find routes" })).toBeDisabled();
  await page.getByRole("button", { name: "Use my location" }).click();
  await expect.poll(() => page.evaluate(() => window.__gpsRequestCount)).toBe(1);
  await expect(page.getByText("Location permission was denied.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Choose starting point" })).toBeEnabled();
});

test("global named places remain selectable and an unsupported journey is explained", async ({ page }) => {
  const tokyo = { id: "geoapify:tokyo-tower", label: "Tokyo Tower", addressLine: "Minato City, Tokyo, Japan", category: "tourism.attraction", source: "Geoapify", confidence: 0.99, coordinates: { lat: 35.6586, lon: 139.7454 } };
  const eiffel = { id: "geoapify:eiffel-tower", label: "Eiffel Tower", addressLine: "Champ de Mars, Paris, France", category: "tourism.attraction", source: "Geoapify", confidence: 0.99, coordinates: { lat: 48.8584, lon: 2.2945 } };
  await page.route("**/v1/places/search**", async (route) => {
    const query = new URL(route.request().url()).searchParams.get("q")?.toLowerCase() ?? "";
    const result = query.includes("eiffel") ? eiffel : tokyo;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ places: [result] }) });
  });
  await page.route("**/v1/trips/compare", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
    origin: eiffel, destination: tokyo, generatedAt: "2026-11-08T00:00:00.000Z", scope: "unsupported", options: [],
    warnings: ["Place found; transport comparison is not supported for this journey yet. Wandr cannot compare verified fares or passenger services here."],
  }) }));
  await page.goto("/");
  await page.getByRole("button", { name: "Choose starting point" }).click();
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
  await expect(page.getByText(/Place found; transport comparison is not supported/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Choose starting point, Eiffel Tower/ })).toHaveCount(0);
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
