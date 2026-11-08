import { expect, test } from "@playwright/test";

const sizes = [
  [320, 568], [320, 700], [360, 640], [375, 667], [390, 844],
  [430, 932], [600, 820], [768, 1024], [1280, 800], [844, 390],
] as const;
const verboseUiCopy = ["reference estimate", "Illustrative local estimate", "Conditional fare reference", "Airport-to-airport corridor preview", "Air corridor ", "Route reference ", "About ", "Est. ₱", "Source and estimate limits", "Geographic air corridor", "No schedule or nonstop service claim", "Geoapify road path used as a distance reference"];

const addu = { id: "geoapify:addu-jacinto-fixture", label: "Ateneo de Davao University — Jacinto/Main Campus", addressLine: "E. Jacinto Street, Davao City, Philippines", city: "Davao City", country: "Philippines", countryCode: "PH", coordinates: { lat: 7.072316, lon: 125.612838 } };
const cityHall = { id: "geoapify:davao-city-hall-fixture", label: "Davao City Hall", addressLine: "Davao City, Philippines", city: "Davao City", country: "Philippines", countryCode: "PH", coordinates: { lat: 7.064, lon: 125.608 } };
const tokyo = { id: "geoapify:tokyo-tower-fixture", label: "Tokyo Tower", addressLine: "Minato City, Tokyo, Japan", city: "Tokyo", country: "Japan", countryCode: "JP", coordinates: { lat: 35.6586, lon: 139.7454 } };
const airports = {
  origin: { iata: "DVO", name: "Francisco Bangoy International Airport", coordinates: { lat: 7.1255, lon: 125.6458 }, countryCode: "PH", municipality: "Davao", type: "large_airport", region: "PH-11" },
  destination: { iata: "HND", name: "Tokyo Haneda International Airport", coordinates: { lat: 35.5494, lon: 139.7798 }, countryCode: "JP", municipality: "Tokyo", type: "large_airport", region: "JP-13" },
};
const road = { type: "LineString", coordinates: [[125.612838, 7.072316], [125.61, 7.069], [125.608, 7.064]] };
const corridor = { type: "LineString", coordinates: Array.from({ length: 21 }, (_, index) => [airports.origin.coordinates.lon + (airports.destination.coordinates.lon - airports.origin.coordinates.lon) * index / 20, airports.origin.coordinates.lat + (airports.destination.coordinates.lat - airports.origin.coordinates.lat) * index / 20]) };

function localOption(id: string, providerId: string, title: string, mode: string, min: number, max: number, seconds: number) {
  return {
    id, providerId, title, mode,
    legs: [{ mode: "drive", title: "Driving route", distanceMeters: 3_200, durationSeconds: 420, geometry: road, steps: [], source: "Geoapify Routing" }],
    fare: { currency: "PHP", min, max, status: "estimated", sourceName: "UI fixture demo model", sourceUrl: null, checkedAt: null },
    totalDurationSeconds: seconds, totalWalkingMeters: 0, transfers: null, availability: "estimated_demo",
    estimate: { kind: "demo_model", modelId: `fixture-${id}`, version: "fixture-1", basis: "Synthetic UI test fixture", note: "Fixture only; not provider data." },
    note: null, rankingEligible: { cheapest: true, fastest: true },
  };
}

const localResponse = {
  origin: addu, destination: cityHall, generatedAt: "2026-11-08T00:00:00.000Z", scope: "davao_city", journeyType: "local", airports: null, airRoute: null, warnings: [],
  options: [
    localOption("grab-1", "grab_taxi", "Grab Taxi", "taxi", 80, 100, 780),
    localOption("green-1", "green_gsm_taxi", "Green GSM Taxi", "taxi", 90, 120, 840),
    localOption("maxim-1", "maxim_motorcycle", "Maxim Motorcycle", "motorcycle", 40, 60, 600),
    localOption("jeepney-1", "jeepney", "Jeepney", "jeepney", 20, 20, 1_020),
    localOption("grab-2", "grab_taxi", "Grab Taxi", "taxi", 100, 120, 900),
    localOption("green-2", "green_gsm_taxi", "Green GSM Taxi", "taxi", 110, 130, 960),
    localOption("maxim-2", "maxim_motorcycle", "Maxim Motorcycle", "motorcycle", 50, 70, 660),
  ],
};

function airline(providerId: "philippine_airlines" | "cebu_pacific", title: string, min: number, max: number) {
  return {
    id: `air-${providerId}`, providerId, title, mode: "flight",
    legs: [{ mode: "flight", title: "Geographic air corridor", distanceMeters: 3_400_000, durationSeconds: 28_800, geometry: corridor, steps: [], source: "Wandr great-circle preview" }],
    fare: { currency: "PHP", min, max, status: "estimated", sourceName: "Wandr demo model", sourceUrl: null, checkedAt: null },
    totalDurationSeconds: 28_800, totalWalkingMeters: 0, transfers: null, availability: "estimated_demo",
    estimate: { kind: "demo_model", modelId: `fixture-${providerId}`, version: "fixture-1", basis: "Synthetic UI fixture", note: "Fixture only; not a carrier quote." },
    note: null, rankingEligible: { cheapest: true, fastest: true },
  };
}

const airResponse = {
  origin: addu, destination: tokyo, generatedAt: "2026-11-08T00:00:00.000Z", scope: "international", journeyType: "international", airports,
  airRoute: { geometry: corridor, distanceMeters: 3_400_000, durationSeconds: 28_800, source: "great_circle_preview", note: "Fixture corridor." }, warnings: [],
  options: [airline("philippine_airlines", "Philippine Airlines", 12_300, 19_600), airline("cebu_pacific", "Cebu Pacific", 18_500, 24_000)],
};

async function chooseDestination(page: import("@playwright/test").Page, label: string) {
  await page.getByRole("button", { name: "Choose destination" }).click();
  const input = page.getByRole("combobox", { name: "Destination place search" });
  await input.fill(label);
  await expect(page.getByRole("option").first()).toBeVisible();
  await page.getByRole("option").filter({ hasText: label }).first().click();
  await page.getByRole("button", { name: "Find routes" }).click();
  await expect(page.getByRole("heading", { name: "Route options" })).toBeVisible();
}

async function captureMatrix(page: import("@playwright/test").Page, name: string, details: boolean) {
  const sheetSelector = details ? ".sheet-details" : name === "search" ? ".sheet-search" : ".sheet-results";
  const sheetText = await page.locator(sheetSelector).innerText();
  for (const phrase of verboseUiCopy) expect(sheetText.toLowerCase()).not.toContain(phrase.toLowerCase());
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    if (details) {
      expect(await page.locator(".detail-metrics > div > span").allTextContents()).toEqual(["Fare", "ETA", "Distance"]);
      const geometry = await page.locator(".detail-metrics > div").evaluateAll((elements) => elements.map((element) => {
        const bounds = element.getBoundingClientRect();
        return { top: bounds.top, left: bounds.left, right: bounds.right, scrollWidth: (element as HTMLElement).scrollWidth, clientWidth: (element as HTMLElement).clientWidth };
      }));
      expect(geometry).toHaveLength(3);
      expect(new Set(geometry.map((item) => item.top)).size).toBe(1);
      expect(geometry.every((item) => item.scrollWidth <= item.clientWidth)).toBe(true);
      expect(geometry.every((item) => item.left >= 0 && item.right <= width)).toBe(true);
    }
    if (!details && name.endsWith("results")) {
      const ratio = await page.locator(".sheet-results").evaluate((element) => {
        const sheet = element.getBoundingClientRect();
        const viewport = document.querySelector(".app-viewport")!.getBoundingClientRect();
        return sheet.height / viewport.height;
      });
      expect(ratio).toBeGreaterThan(0.54);
      expect(ratio).toBeLessThan(0.66);
      if (name === "air-results" && width === 320 && height === 700) {
        await expect.poll(() => page.evaluate(() => {
          const map = document.querySelector(".route-map")?.getBoundingClientRect();
          const sheet = document.querySelector(".sheet-results")?.getBoundingClientRect();
          const markers = [...document.querySelectorAll(".map-marker-airport")].map((element) => element.getBoundingClientRect());
          return Boolean(map && sheet && markers.length === 2 && markers.every((marker) => marker.top >= map.top && marker.bottom <= sheet.top));
        })).toBe(true);
      }
    }
    const overflows = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth > innerWidth,
      shell: (document.querySelector(".app-viewport") as HTMLElement).scrollWidth > (document.querySelector(".app-viewport") as HTMLElement).clientWidth,
      sheet: (document.querySelector(".sheet") as HTMLElement).scrollWidth > (document.querySelector(".sheet") as HTMLElement).clientWidth,
    }));
    expect(overflows).toEqual({ document: false, shell: false, sheet: false });
    await page.screenshot({ path: `/tmp/wandr-ui-polish/${name}-${width}x${height}.png` });
  }
}

test("Search, local/air results and details fit the full viewport matrix", async ({ page }) => {
  test.setTimeout(120_000);
  const submittedOrigins: Array<{ id: string; coordinates: { lat: number; lon: number } }> = [];
  await page.route("**/v1/places/search**", async (route) => {
    const query = new URL(route.request().url()).searchParams.get("q")?.toLowerCase() ?? "";
    await route.fulfill({ json: { places: [query.includes("tokyo") ? tokyo : cityHall] } });
  });
  await page.route("**/v1/trips/compare", async (route) => {
    const request = route.request().postDataJSON() as { origin: { id: string; coordinates: { lat: number; lon: number } }; destination?: { id?: string } };
    submittedOrigins.push(request.origin);
    await route.fulfill({ json: request.destination?.id === tokyo.id ? airResponse : localResponse });
  });
  await page.goto("/");
  await page.locator('.route-map[data-map-ready="true"]').waitFor({ state: "visible", timeout: 20_000 });
  await expect(page.getByRole("button", { name: /Choose starting point, Ateneo de Davao University — Jacinto\/Main Campus/ })).toBeVisible();
  await captureMatrix(page, "search", false);
  await page.setViewportSize({ width: 390, height: 844 });
  await chooseDestination(page, "Davao City Hall");
  expect(submittedOrigins[0]).toMatchObject({ id: "geoapify:51bfefdfbc38675f4059ffe89b340d4a1c40f00102f9013d69ba0100000000c0020192031a4174656e656f20646520446176616f20556e6976657273697479e203206f70656e7374726565746d61703a76656e75653a7761792f3238393933383533", coordinates: { lat: 7.072316, lon: 125.612838 } });
  await expect(page.locator(".option-card")).toHaveCount(7);
  await captureMatrix(page, "local-results", false);
  await page.setViewportSize({ width: 320, height: 568 });
  const beforeScroll = await page.evaluate(() => ({
    sort: document.querySelector(".mode-toggle")?.getBoundingClientRect().toJSON(),
    summary: document.querySelector(".trip-summary")?.getBoundingClientRect().toJSON(),
  }));
  const scrollMetrics = await page.locator(".option-list-scroll").evaluate((element) => {
    const list = element as HTMLElement;
    list.scrollTop = list.scrollHeight;
    return { top: list.scrollTop, height: list.scrollHeight, visibleHeight: list.clientHeight };
  });
  expect(scrollMetrics.top).toBeGreaterThan(0);
  expect(scrollMetrics.height).toBeGreaterThan(scrollMetrics.visibleHeight);
  expect(await page.evaluate(() => ({ sort: document.querySelector(".mode-toggle")?.getBoundingClientRect().toJSON(), summary: document.querySelector(".trip-summary")?.getBoundingClientRect().toJSON() }))).toEqual(beforeScroll);
  await page.getByRole("button", { name: "Get there faster" }).click();
  await expect(page.locator(".option-badge")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Get there faster" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".mode-toggle-indicator")).toHaveCSS("transform", /matrix\(1, 0, 0, 1/);
  await page.locator('.option-card[data-provider-id="grab_taxi"]').first().click();
  await expect(page.locator(".detail-metrics > div")).toHaveCount(3);
  await captureMatrix(page, "local-details", true);

  const airPage = await page.context().newPage();
  await airPage.route("**/v1/places/search**", async (route) => route.fulfill({ json: { places: [tokyo] } }));
  await airPage.route("**/v1/trips/compare", async (route) => route.fulfill({ json: airResponse }));
  await airPage.setViewportSize({ width: 390, height: 844 });
  await airPage.goto("/");
  await airPage.locator('.route-map[data-map-ready="true"]').waitFor({ state: "visible", timeout: 20_000 });
  await chooseDestination(airPage, "Tokyo Tower");
  await expect(airPage.locator(".option-card").first()).toContainText("ETA");
  await expect.poll(() => airPage.locator('.option-card[data-provider-id="philippine_airlines"] img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await captureMatrix(airPage, "air-results", false);
  await airPage.setViewportSize({ width: 390, height: 844 });
  await airPage.locator('.option-card[data-provider-id="philippine_airlines"]').click();
  await expect(airPage.locator(".detail-metrics > div")).toHaveCount(3);
  await captureMatrix(airPage, "air-details", true);
  await airPage.close();
});

test("Search, details and result cards stay usable at large text scale and short keyboard height", async ({ page }) => {
  await page.route("**/v1/places/search**", async (route) => route.fulfill({ json: { places: [cityHall] } }));
  await page.route("**/v1/trips/compare", async (route) => route.fulfill({ json: localResponse }));
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/");
  await page.addStyleTag({ content: "html { font-size: 150% !important; }" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await page.locator(".primary-button").evaluate((element) => getComputedStyle(element).transitionDuration)).toBe("0s");
  await page.getByRole("button", { name: "Choose destination" }).click();
  const picker = page.getByRole("combobox", { name: "Destination place search" });
  await page.setViewportSize({ width: 320, height: 360 });
  await picker.fill("Davao City Hall");
  await expect(picker).toBeVisible();
  await page.getByRole("option").first().click();
  await page.getByRole("button", { name: "Find routes" }).click();
  await expect(page.getByRole("heading", { name: "Route options" })).toBeVisible();
  await expect(page.locator(".option-list-scroll")).toBeVisible();
  await page.locator('.option-card[data-provider-id="grab_taxi"]').first().click();
  const tiles = await page.locator(".detail-metrics > div").evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().top));
  expect(new Set(tiles).size).toBe(1);
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle)).toBe("solid");
});

test("platform hint changes presentation only and keeps the shared search flow", async ({ browser, page }) => {
  await page.goto("/");
  await expect(page.locator(".app-viewport")).toHaveAttribute("data-platform-ui", "ios");

  const androidContext = await browser.newContext({
    userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36",
    viewport: { width: 390, height: 844 },
  });
  const androidPage = await androidContext.newPage();
  await androidPage.goto("/");
  await expect(androidPage.locator(".app-viewport")).toHaveAttribute("data-platform-ui", "android");
  await expect(androidPage.getByRole("button", { name: "Use my current location" })).toBeVisible();
  await expect(androidPage.getByRole("button", { name: "Find routes" })).toBeDisabled();
  await androidContext.close();
});
