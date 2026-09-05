import { expect, test } from "@playwright/test";

const archiveRequest = /\/drought_forecast_archive_rev02(?:-[\w-]+)?\.json$/;

test("login and overview defer the archive while preserving summary and forecast navigation", async ({ page }) => {
  let archiveRequests = 0;
  page.on("request", (request) => { if (archiveRequest.test(request.url())) archiveRequests += 1; });
  await page.goto("/login");
  await page.getByLabel("ชื่อผู้ใช้").fill("pointy");
  expect(archiveRequests).toBe(0);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  const summary = page.locator(".nr-forecast-overview");
  await expect(summary).toContainText("142/289 ตำบล");
  await expect(summary).toContainText("ธ.ค. 2568");
  await expect(page.locator(".nr-map-shape")).toHaveCount(289);
  expect(archiveRequests).toBe(0);
  await summary.locator(".nr-forecast-overview-details").click();
  await expect(page.locator(".nr-drought-compact-workspace")).toBeVisible();
  await expect(page.locator(".nr-map-shape")).toHaveCount(289);
  await expect(page).toHaveURL(/target=2025-12&horizon=1/);
  expect(archiveRequests).toBe(1);
});

test("failed archive loads can retry without losing target or horizon", async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem("korat-tan-phai-login-user", "pointy"));
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
  await expect(page.locator(".nr-forecast-archive-mode-section")).toContainText("2 · เสี่ยงสูง");
  await expect(page).toHaveURL(/target=2025-12&horizon=4/);
  expect(attempts).toBe(2);
});

test("leaving a pending archive load keeps overview usable and reuses its result on return", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("korat-tan-phai-login-user", "pointy"));
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
  await page.getByRole("button", { name: "กลับภาพรวม", exact: true }).click();
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
  await page.addInitScript(() => localStorage.setItem("korat-tan-phai-login-user", "pointy"));
  await page.route("**/geodata/thailand-adm1.geojson", (route) => route.fulfill({ status: 503, body: "Unavailable" }));
  await page.route("**/geodata/nakhon-ratchasima-boundary.geojson", (route) => route.fulfill({ status: 503, body: "Unavailable" }));
  await page.goto("/drought?target=2025-12&horizon=1");
  await expect(page.locator(".nr-drought-compact-workspace")).toBeVisible();
  await expect(page.locator(".nr-map-shape")).toHaveCount(289);
  await expect(page.locator(".nr-forecast-archive-mode-section")).toContainText("142/289 ตำบล");
});
