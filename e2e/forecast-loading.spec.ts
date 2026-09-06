import { expect, test, fillAuthForm, seedAuthSession } from "./fixtures";

const archiveRequest = /\/drought_forecast_archive_rev02(?:-[\w-]+)?\.json$/;
const overviewRequest = /\/forecast-overview-t1(?:-[\w-]+)?\.json$/;

for (const [name, path, request, title] of [
  ["overview", "/?target=2025-12&horizon=1", overviewRequest, "จังหวัดนครราชสีมา"],
  ["province", "/drought?target=2025-12&horizon=4", archiveRequest, "ภัยแล้ง"],
  ["district", "/dan-khun-thot?target=2025-12&horizon=4", archiveRequest, "ด่านขุนทด"],
  ["subdistrict", "/dan-khun-thot/t-300806?target=2025-12&horizon=4", archiveRequest, "บ้านเก่า"],
] as const) {
  test(`${name} loading keeps route context and neutral responsive placeholders until data arrives`, async ({ page }, testInfo) => {
    await seedAuthSession(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    let release = () => {};
    const held = new Promise<void>((resolve) => { release = resolve; });
    await page.route(request, async (route) => { await held; await route.continue(); });
    try {
      await page.goto(path);
      const loading = page.locator(".nr-forecast-load-state");
      await expect(loading.getByRole("status")).toBeVisible();
      await expect(page.getByRole("heading", { name: new RegExp(title), level: 1 })).toBeVisible();
      await expect(loading.getByRole("button")).toHaveCount(0);
      await expect(loading.locator(".nr-loading-map")).toBeVisible();
      await expect(loading.locator(".nr-loading-chart")).toHaveCount(name === "overview" || name === "subdistrict" ? 0 : 1);
      await expect(loading.locator(".nr-loading-metrics.is-single .metric-card")).toHaveCount(name === "subdistrict" ? 1 : 0);
      if (name !== "overview") {
        await expect(loading.locator(".nr-loading-context small").nth(0)).toHaveText("เดือนตั้งต้น (T)");
        await expect(loading.locator(".nr-loading-context small").nth(1)).toHaveText("เดือนที่พยากรณ์");
      }
      expect(await loading.innerText()).not.toMatch(/0 ตำบล|\d+%/);
      expect(await loading.locator(".nr-skeleton").first().evaluate(node => getComputedStyle(node).animationName)).toBe("none");
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
      const headingBefore = await page.getByRole("heading", { name: new RegExp(title), level: 1 }).boundingBox();
      await page.evaluate(() => scrollTo({ top: 0, left: 0, behavior: "instant" }));
      await page.screenshot({ path: testInfo.outputPath(`${name}-loading.png`), fullPage: true });
      release();
      await expect(loading).toHaveCount(0);
      await expect(page.locator(".nr-map-shape")).toHaveCount(289);
      const headingAfter = await page.getByRole("heading", { name: new RegExp(title), level: 1 }).boundingBox();
      expect(Math.abs(headingBefore!.y - headingAfter!.y)).toBeLessThanOrEqual(4);
      if (name === "subdistrict") {
        await expect(page.locator(".nr-drought-workspace-kpis .metric-card")).toHaveCount(1);
        await expect(page.locator(".nr-drought-workspace-chart-card")).toHaveCount(0);
      }
    } finally { release(); }
  });
}

test("overview failure keeps its identity and retries the same selected month", async ({ page }) => {
  await seedAuthSession(page);
  let attempts = 0;
  await page.route(overviewRequest, async (route) => {
    attempts += 1;
    if (attempts === 1) await route.fulfill({ status: 503, body: "Unavailable" });
    else await route.continue();
  });
  await page.goto("/?target=2025-10&horizon=1");
  await expect(page.getByRole("alert")).toHaveText("โหลดข้อมูลพยากรณ์ไม่สำเร็จ กรุณาลองใหม่");
  await expect(page.getByRole("heading", { name: "จังหวัดนครราชสีมา", level: 1 })).toBeVisible();
  await expect(page.locator(".nr-skeleton")).toHaveCount(0);
  await page.getByRole("button", { name: "ลองใหม่", exact: true }).click();
  await expect(page.locator(".nr-forecast-overview-summary")).toBeVisible();
  await expect(page).toHaveURL(/target=2025-10&horizon=1/);
  expect(attempts).toBe(2);
});

test("login and overview defer the archive while preserving summary and forecast navigation", async ({ page }) => {
  let archiveRequests = 0;
  page.on("request", (request) => { if (archiveRequest.test(request.url())) archiveRequests += 1; });
  await page.goto("/login");
  await fillAuthForm(page);
  expect(archiveRequests).toBe(0);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  const summary = page.locator(".nr-forecast-overview");
  await expect(summary).toContainText("142/289 ตำบล");
  await expect(summary.locator(".nr-forecast-overview-context")).toContainText("พยากรณ์ ม.ค. 2569");
  await expect(summary.locator(".nr-forecast-overview-context")).toContainText("เดือนตั้งต้น (T) ธ.ค. 2568");
  await expect(page.locator(".nr-map-shape")).toHaveCount(289);
  expect(archiveRequests).toBe(0);
  await summary.locator(".nr-forecast-overview-details").click();
  await expect(page.locator(".nr-drought-compact-workspace")).toBeVisible();
  await expect(page.locator(".nr-map-shape")).toHaveCount(289);
  await expect(page).toHaveURL(/target=2025-12&horizon=1/);
  expect(archiveRequests).toBe(1);
});

test("failed archive loads can retry without losing target or horizon", async ({ page }, testInfo) => {
  await seedAuthSession(page);
  let attempts = 0;
  await page.route(archiveRequest, async (route) => {
    attempts += 1;
    if (attempts === 1) await route.fulfill({ status: 503, body: "Unavailable" });
    else await route.continue();
  });
  await page.goto("/dan-khun-thot/t-300806?mapLayer=forecast-archive&target=2025-12&horizon=4");
  await expect(page.getByRole("alert")).toHaveText("โหลดข้อมูลพยากรณ์ไม่สำเร็จ กรุณาลองใหม่");
  await expect(page.locator(".nr-drought-compact-workspace")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("archive-load-error.png"), fullPage: true });
  await page.getByRole("button", { name: "ลองใหม่", exact: true }).click();
  await expect(page.getByRole("heading", { name: /ภัยแล้ง.*บ้านเก่า/, level: 1 })).toBeVisible();
  await expect(page.locator(".nr-drought-workspace-horizon").getByRole("tab", { selected: true })).toContainText("T+4");
  await expect(page.locator(".nr-drought-workspace-horizon").getByRole("tab", { selected: true }).locator("span")).toHaveText("เม.ย. 2569");
  await expect(page.locator(".nr-drought-workspace-kpis")).toContainText("เสี่ยงสูง");
  await expect(page).toHaveURL(/target=2025-12&horizon=4/);
  expect(attempts).toBe(2);
});

test("leaving a pending archive load keeps overview usable and reuses its result on return", async ({ page }) => {
  await seedAuthSession(page);
  let requests = 0;
  const geometryRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith(".geojson")) geometryRequests.push(new URL(request.url()).pathname);
  });
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route(archiveRequest, async (route) => { requests += 1; await held; await route.continue(); });
  await page.goto("/drought?target=2025-12&horizon=6");
  await expect(page.getByRole("status")).toHaveText("กำลังโหลดข้อมูลพยากรณ์ภัยแล้ง");
  await expect.poll(() => geometryRequests.length).toBe(3);
  await expect(page.locator(".nr-drought-compact-workspace")).toHaveCount(0);
  await page.getByRole("button", { name: "ภาพรวมจังหวัด", exact: true }).click();
  await expect(page.locator(".nr-forecast-overview-summary")).toContainText("142/289 ตำบล");
  const response = page.waitForResponse(archiveRequest);
  release();
  await (await response).finished();
  await expect(page.locator(".nr-forecast-overview-summary")).toBeVisible();
  await page.goBack();
  await expect(page.locator(".nr-drought-compact-workspace")).toBeVisible();
  await expect(page.locator(".nr-drought-workspace-horizon").getByRole("tab", { selected: true })).toContainText("T+6");
  expect(requests).toBe(1);
  expect(geometryRequests).toHaveLength(3);
});

test("optional map context failure does not hide the forecast or its local polygons", async ({ page }) => {
  await seedAuthSession(page);
  await page.route("**/geodata/thailand-adm1.geojson", (route) => route.fulfill({ status: 503, body: "Unavailable" }));
  await page.route("**/geodata/nakhon-ratchasima-boundary.geojson", (route) => route.fulfill({ status: 503, body: "Unavailable" }));
  await page.goto("/drought?target=2025-12&horizon=1");
  await expect(page.locator(".nr-drought-compact-workspace")).toBeVisible();
  await expect(page.locator(".nr-map-shape")).toHaveCount(289);
  await expect(page.locator(".nr-drought-workspace-kpis")).toContainText("142/289 ตำบล");
});
