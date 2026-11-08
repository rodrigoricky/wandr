import { expect, test } from "@playwright/test";

async function retainWebGlPixels(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext as (this: HTMLCanvasElement, type: string, options?: WebGLContextAttributes) => RenderingContext | null;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, options?: WebGLContextAttributes) {
      if (type === "webgl" || type === "webgl2") {
        return getContext.call(this, type, { ...options, preserveDrawingBuffer: true });
      }
      return getContext.call(this, type, options);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
}

async function renderedPixels(page: import("@playwright/test").Page) {
  return page.locator(".route-map canvas").evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!gl) throw new Error("WebGL is unavailable");
    const positions = [[20, 20], [canvas.width / 4, canvas.height / 4], [canvas.width / 2, canvas.height / 2], [canvas.width * 3 / 4, canvas.height / 3], [canvas.width / 2, canvas.height * 3 / 4]];
    const pixels = positions.map(([x, y]) => {
      const pixel = new Uint8Array(4);
      gl.readPixels(Math.floor(x), Math.floor(y), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      return [...pixel];
    });
    return { width: canvas.width, height: canvas.height, pixels, glError: gl.getError() };
  });
}

test("production basemap resources render actual pixels and resize without losing the map", async ({ page }) => {
  await retainWebGlPixels(page);
  const tiles: { status: number; type: string }[] = [];
  page.on("response", (response) => {
    if (response.url().includes("tiles.openfreemap.org/planet/") && response.url().endsWith(".pbf")) {
      tiles.push({ status: response.status(), type: response.headers()["content-type"] ?? "" });
    }
  });
  await page.goto("/");
  const map = page.locator('.route-map[data-map-provider="openfreemap"]');
  await expect(map).toHaveAttribute("data-map-ready", "true", { timeout: 25_000 });
  await expect(map).toHaveAttribute("data-map-theme", "wandr-blue");
  await expect(map).toHaveAttribute("data-map-theme-layers", /(^|,)water(,|$)/);
  await expect.poll(() => tiles.some((tile) => tile.status === 200 && tile.type.includes("vector-tile")), { timeout: 20_000 }).toBe(true);
  await expect.poll(async () => {
    const result = await renderedPixels(page);
    return new Set(result.pixels.map((pixel) => pixel.join(","))).size;
  }, { timeout: 10_000 }).toBeGreaterThan(1);

  for (const width of [320, 375, 390, 430, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await page.locator(".route-map canvas").screenshot({ path: `/tmp/wandr-map-${width}.png` });
    await expect.poll(async () => (await renderedPixels(page)).width).toBeGreaterThan(0);
    await expect(map).toHaveAttribute("data-map-ready", "true");
  }
});

test("the supplied logo asset is served and the initial overlay clears on a usable map", async ({ page }) => {
  const asset = await page.request.get("/logo.png");
  expect(asset.status()).toBe(200);
  expect(asset.headers()["content-type"]).toContain("image/png");
  expect((await asset.body()).byteLength).toBeGreaterThan(100_000);

  await page.goto("/");
  await expect(page.locator('.route-map[data-map-ready="true"]')).toHaveAttribute("data-map-provider", "openfreemap", { timeout: 25_000 });
  await expect(page.locator(".map-loading-overlay")).toHaveCount(0);
});

test("slow cold map loads reveal the logo after the threshold and fade it after first usable state", async ({ page }) => {
  test.setTimeout(40_000);
  await page.route("https://tiles.openfreemap.org/styles/positron", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    const response = await route.fetch();
    await route.fulfill({ response });
  });
  await page.goto("/");
  await page.waitForTimeout(120);
  await expect(page.locator(".map-loading-overlay")).toHaveCount(0);
  await expect(page.locator(".map-loading-overlay")).toBeVisible({ timeout: 2_000 });
  await expect(page.locator(".map-loading-overlay img")).toHaveAttribute("src", "/logo.png");
  await expect.poll(() => page.locator(".map-loading-overlay img").evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator('.route-map[data-map-ready="true"]')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".map-loading-overlay")).toHaveCount(0, { timeout: 2_000 });
});

test("reduced motion removes the overlay fade transition and repeated map updates do not replay it", async ({ page }) => {
  test.setTimeout(40_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("https://tiles.openfreemap.org/styles/positron", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    const response = await route.fetch();
    await route.fulfill({ response });
  });
  await page.goto("/");
  await expect(page.locator(".map-loading-overlay")).toBeVisible({ timeout: 2_000 });
  await expect(page.locator(".map-loading-overlay")).toHaveCSS("transition-duration", "0s");
  await expect(page.locator('.route-map[data-map-ready="true"]')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".map-loading-overlay")).toHaveCount(0, { timeout: 2_000 });
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.waitForTimeout(400);
  await expect(page.locator(".map-loading-overlay")).toHaveCount(0);
});

test("when both map providers fail, the failure state clears the logo overlay", async ({ page }) => {
  test.setTimeout(45_000);
  const fallbackTileStatuses: number[] = [];
  await page.route("https://tiles.openfreemap.org/styles/positron", async (route) => {
    await route.fulfill({ status: 503, contentType: "text/plain", body: "simulated primary outage" });
  });
  await page.route("https://tile.openstreetmap.org/**/*.png", async (route) => {
    fallbackTileStatuses.push(503);
    await route.fulfill({ status: 503, contentType: "image/png", body: "" });
  });
  await page.goto("/");
  await expect(page.locator('.route-map[data-map-provider="openstreetmap"]')).toHaveAttribute("data-map-ready", "true", { timeout: 35_000 });
  await expect(page.getByRole("status").filter({ hasText: /Using backup map tiles|Map tiles are unavailable/ })).toBeVisible();
  expect(fallbackTileStatuses.length).toBeGreaterThan(0);
  await expect(page.locator(".map-loading-overlay")).toHaveCount(0);
});

test("a sprite request failure leaves the usable primary map visible", async ({ page }) => {
  await retainWebGlPixels(page);
  const failedSprites: number[] = [];
  await page.route("https://tiles.openfreemap.org/sprites/**/*.json", async (route) => {
    failedSprites.push(1);
    await route.fulfill({ status: 503, contentType: "text/plain", body: "temporary sprite outage" });
  });
  await page.goto("/");
  const map = page.locator('.route-map[data-map-provider="openfreemap"]');
  await expect(map).toHaveAttribute("data-map-ready", "true", { timeout: 25_000 });
  expect(failedSprites.length).toBeGreaterThan(0);
  await expect(map).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Map tiles are unavailable" })).toHaveCount(0);
  await expect.poll(async () => new Set((await renderedPixels(page)).pixels.map((pixel) => pixel.join(","))).size).toBeGreaterThan(1);
});

test("a confirmed primary-style outage falls back to OSM raster and recovers to OpenFreeMap online", async ({ page }) => {
  await retainWebGlPixels(page);
  let allowPrimaryStyle = false;
  const primaryStyleStatuses: number[] = [];
  const fallbackTileStatuses: number[] = [];
  await page.route("https://tiles.openfreemap.org/styles/positron", async (route) => {
    if (!allowPrimaryStyle) {
      primaryStyleStatuses.push(503);
      await route.fulfill({ status: 503, contentType: "text/plain", body: "simulated primary style outage" });
      return;
    }
    const response = await route.fetch();
    primaryStyleStatuses.push(response.status());
    await route.fulfill({ response });
  });
  page.on("response", (response) => {
    if (response.url().startsWith("https://tile.openstreetmap.org/") && response.url().endsWith(".png")) fallbackTileStatuses.push(response.status());
  });
  await page.goto("/");
  const map = page.locator('.route-map[data-map-provider="openstreetmap"]');
  await expect(map).toHaveAttribute("data-map-ready", "true", { timeout: 30_000 });
  await expect(map).toHaveAttribute("data-map-theme", "none");
  expect(primaryStyleStatuses).toContain(503);
  await expect(page.getByRole("link", { name: /OpenStreetMap/ })).toBeVisible();
  await expect.poll(() => fallbackTileStatuses.includes(200), { timeout: 20_000 }).toBe(true);
  await expect.poll(async () => new Set((await renderedPixels(page)).pixels.map((pixel) => pixel.join(","))).size).toBeGreaterThan(1);
  await page.locator(".route-map canvas").screenshot({ path: "/tmp/wandr-map-fallback-390.png" });

  allowPrimaryStyle = true;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.locator('.route-map[data-map-provider="openfreemap"]')).toHaveAttribute("data-map-ready", "true", { timeout: 25_000 });
  await expect(page.locator('.route-map[data-map-provider="openfreemap"]')).toHaveAttribute("data-map-theme", "wandr-blue");
  expect(primaryStyleStatuses).toContain(200);
  await expect.poll(async () => new Set((await renderedPixels(page)).pixels.map((pixel) => pixel.join(","))).size).toBeGreaterThan(1);
});

test("WebGL restoration and repeated map initialization keep one live map", async ({ page }) => {
  await retainWebGlPixels(page);
  await page.goto("/");
  const map = page.locator('.route-map[data-map-provider="openfreemap"]');
  await expect(map).toHaveAttribute("data-map-ready", "true", { timeout: 25_000 });
  const contextExtension = await page.locator(".route-map canvas").evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    const extension = gl?.getExtension("WEBGL_lose_context");
    if (!gl || !extension) return false;

    const state = window as unknown as { __wandrRestoreContext?: () => Promise<boolean> };
    canvas.addEventListener("webglcontextlost", (event) => event.preventDefault(), { once: true });
    state.__wandrRestoreContext = () => new Promise<boolean>((resolve) => {
      const timeout = window.setTimeout(() => resolve(false), 8_000);
      canvas.addEventListener("webglcontextrestored", () => {
        window.clearTimeout(timeout);
        resolve(!gl.isContextLost());
      }, { once: true });
      extension.restoreContext();
    });
    extension.loseContext();
    return true;
  });
  test.skip(!contextExtension, "The browser does not expose WEBGL_lose_context.");
  await expect(page.getByRole("status").filter({ hasText: "Map display paused." })).toBeVisible();
  const contextRestored = await page.evaluate(async () => {
    const state = window as unknown as { __wandrRestoreContext?: () => Promise<boolean> };
    return state.__wandrRestoreContext?.() ?? false;
  });
  expect(contextRestored).toBe(true);
  await expect(map).toHaveAttribute("data-map-ready", "true", { timeout: 10_000 });
  await expect.poll(async () => new Set((await renderedPixels(page)).pixels.map((pixel) => pixel.join(","))).size).toBeGreaterThan(1);

  for (let attempt = 0; attempt < 2; attempt++) {
    await page.reload();
    await expect(page.locator('.route-map[data-map-ready="true"]')).toBeVisible({ timeout: 25_000 });
    await expect(page.locator(".route-map canvas")).toHaveCount(1);
  }
});
