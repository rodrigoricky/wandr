import { expect, test } from "@playwright/test";

declare global {
  interface Window { __gpsRequestCount: number }
}

const origin = { id: "test-city-hall", label: "Davao City Hall, Davao City", addressLine: "Davao City Hall, Davao City", coordinates: { lat: 7.064, lon: 125.608 } };
const destination = { id: "test-matina", label: "Matina Town Square, Davao City", addressLine: "Matina Town Square, Davao City", coordinates: { lat: 7.05, lon: 125.595 } };
const line = { type: "LineString" as const, coordinates: [[125.608, 7.064], [125.602, 7.057], [125.595, 7.05]] as [number, number][] };

test("manual search, keyboard place selection, sorting, details, and back navigation", async ({ page }) => {
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
      warnings: ["No verified Davao public-transport routes or fare rules are currently available."],
      options: [
        { id: "geoapify-walk", title: "Walk", mode: "walk", legs: [{ mode: "walk", title: "Walking route", distanceMeters: 2400, durationSeconds: 1700, geometry: line, source: "Geoapify Routing" }], fare: { currency: "PHP", min: 0, max: 0, status: "published_rule", sourceName: "No motorized transport", sourceUrl: null, checkedAt: null }, totalDurationSeconds: 1700, totalWalkingMeters: 2400, transfers: 0, availability: "verified_route", note: "Routed walking path.", rankingEligible: { cheapest: true, fastest: true } },
        { id: "geoapify-drive", title: "Drive estimate", mode: "drive", legs: [{ mode: "drive", title: "Driving route estimate", distanceMeters: 2400, durationSeconds: 480, geometry: line, source: "Geoapify Routing" }], fare: { currency: "PHP", min: null, max: null, status: "unknown", sourceName: null, sourceUrl: null, checkedAt: null }, totalDurationSeconds: 480, totalWalkingMeters: 0, transfers: 0, availability: "estimated_road_route", note: "Road driving duration only; availability and fare are unknown.", rankingEligible: { cheapest: false, fastest: true } },
      ],
    }) });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Choose starting point" }).click();
  const originSearch = page.getByRole("textbox", { name: "Starting point place search" });
  await originSearch.fill("City Hall");
  await expect(page.getByRole("option")).toHaveCount(1);
  await originSearch.press("ArrowDown");
  await originSearch.press("Enter");

  await page.getByRole("button", { name: "Choose destination" }).click();
  const destinationSearch = page.getByRole("textbox", { name: "Destination place search" });
  await destinationSearch.fill("Matina");
  await expect(page.getByRole("option")).toHaveCount(1);
  await page.getByRole("option").click();

  await expect(page.getByRole("button", { name: "Find routes" })).toBeEnabled();
  await page.getByRole("button", { name: "Swap origin and destination" }).click();
  await expect(page.getByRole("button", { name: /Choose starting point, Matina Town Square/ })).toBeVisible();
  await page.getByRole("button", { name: "Swap origin and destination" }).click();
  await page.getByRole("button", { name: "Find routes" }).click();

  await expect(page.getByRole("heading", { name: "Route options" })).toBeVisible();
  await expect(page.getByText("No verified Davao public-transport routes or fare rules are currently available.")).toBeVisible();
  await page.getByRole("button", { name: "Shortest route estimate" }).click();
  await expect(page.getByRole("button", { name: "Shortest route estimate" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "View route" }).first().click();
  await expect(page.getByRole("heading", { name: "Route details" })).toBeVisible();
  await expect(page.getByText("Fare unavailable")).toBeVisible();
  await page.getByRole("button", { name: "Back to route options" }).click();
  await expect(page.getByRole("heading", { name: "Route options" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Shortest route estimate" })).toHaveAttribute("aria-pressed", "true");
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

test("required viewport widths keep the app inside its viewport and desktop uses the phone frame", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /OpenStreetMap/ })).toBeVisible({ timeout: 15_000 });
  for (const width of [320, 360, 375, 390, 430, 600, 768, 1280]) {
    await page.setViewportSize({ width, height: width === 320 ? 640 : 820 });
    const metrics = await page.evaluate(() => {
      const frame = document.querySelector(".device-frame");
      if (!frame) throw new Error("phone shell is missing");
      const bounds = frame.getBoundingClientRect();
      return { viewport: window.innerWidth, document: document.documentElement.scrollWidth, frame: bounds.width, border: getComputedStyle(frame).borderWidth };
    });
    expect(metrics.document, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(metrics.viewport);
    if (width < 600) expect(metrics.frame).toBe(width);
    if (width >= 1024) expect(metrics.frame).toBeLessThanOrEqual(430);
  }
});
