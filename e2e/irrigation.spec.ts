import { test, expect, seedAuthSession } from "./fixtures";
import { readFileSync } from "node:fs";
import { forecastSlice } from '../tests/fixtures/forecast-slice.mjs';

const archive = JSON.parse(readFileSync("src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json", "utf8"));
const overview = JSON.parse(readFileSync("src/data/generated/forecast-overview-t1.json", "utf8"));

test.beforeEach(async ({ page }) => {
  await page.route("https://ktp-auth-test.supabase.co/rest/v1/rpc/ktp_load_forecast_slice", (route) => route.fulfill({ json: forecastSlice(route.request().postDataJSON().p_horizon_count === 1 ? overview : archive, route.request().postDataJSON()) }));
  await seedAuthSession(page);
});

test("irrigation filters map, totals and horizons and survives district navigation", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/drought?target=2025-12&horizon=1");
  const initialUrl = page.url();
  const historyLength = await page.evaluate(() => history.length);
  const select = page.locator(".nr-map-panel .nr-irrigation-filter").getByRole("combobox");
  await expect(page.locator(".nr-operational-filters .nr-irrigation-filter")).toHaveCount(0);
  await select.click();
  await page.getByRole("option", { name: "เข้าถึงชลประทาน", exact: true }).click();
  expect(page.url()).toBe(initialUrl);
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
  await expect(page.locator(".nr-local-map-filter-status")).toContainText("แสดง 20 จาก 289 ตำบล");
  await expect(page.locator(".nr-map-shape:not(.is-criteria-filtered)")).toHaveCount(20);
  await expect(page.locator(".nr-drought-workspace-context .is-coverage")).toContainText("/20 ตำบล");
  const expectedTrend = Array.from({ length: 6 }, (_, h) => String(archive.locations.filter((l: any) => l.irrigationStatus === "Irrigation" && archive.packedRiskByTargetMonth["2025-12"][l.subdistrictCode][h] > 0).length));
  await expect(page.locator(".nr-drought-forecast-point-label")).toHaveText(expectedTrend);
  await expect(page.locator(".nr-map-shape:not(.is-criteria-filtered)").first()).toHaveCSS("fill", "rgb(57, 127, 197)");
  await expect(page.locator(".nr-map-legend")).toContainText("ยังไม่มีข้อมูลชลประทาน");
  await expect(page.locator(".nr-map-legend")).not.toContainText("เสี่ยงสูง");
  await page.getByRole("button", { name: "ความเสี่ยงภัยแล้ง", exact: true }).click();
  await expect(page.locator(".nr-map-shape:not(.is-criteria-filtered)").first()).not.toHaveCSS("fill", "rgb(57, 127, 197)");
  await expect(page.locator(".nr-drought-forecast-point-label")).toHaveText(expectedTrend);
  expect(page.url()).toBe(initialUrl);
  await page.getByRole("combobox", { name: "สถานะพยากรณ์ภัยแล้ง", exact: true }).click();
  await page.getByRole("option", { name: "เสี่ยงสูง", exact: true }).click();
  const expectedHigh = archive.locations.filter((l: any) => l.irrigationStatus === "Irrigation" && archive.packedRiskByTargetMonth["2025-12"][l.subdistrictCode][0] === 2).length;
  await expect(page.locator(".nr-map-shape:not(.is-criteria-filtered)")).toHaveCount(expectedHigh);
  await page.getByRole("button", { name: "รีเซ็ต", exact: true }).click();
  await expect(page.locator(".nr-map-shape:not(.is-criteria-filtered)")).toHaveCount(20);
  await expect(select).toContainText("เข้าถึงชลประทาน");
  await page.getByRole("tab", { name: /T\+4/ }).click();
  await expect(page).not.toHaveURL(/irrigation=/);
  await expect(page).toHaveURL(/horizon=4/);
  await page.reload();
  await expect(select).toContainText("เข้าถึงชลประทาน");
  await expect(page.locator(".nr-map-shape:not(.is-criteria-filtered)")).toHaveCount(20);
  await expect(page.getByRole("button", { name: "ชลประทาน", exact: true })).toHaveAttribute("aria-pressed", "true");
  const rail = page.locator(".nr-local-map-criteria.is-forecast-archive-controls");
  expect(await rail.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  const railBox = (await rail.boundingBox())!;
  const statusBox = (await rail.locator(".nr-local-map-filter-status").boundingBox())!;
  expect(statusBox.x + statusBox.width).toBeLessThanOrEqual(railBox.x + railBox.width + 1);
  await page.locator(".nr-operational-area-filter").getByRole("combobox").click();
  await page.getByRole("option", { name: "เมืองนครราชสีมา", exact: true }).click();
  await expect(page).toHaveURL(/mueang-nakhon-ratchasima.*irrigation=irrigated/);
  await expect(page.locator(".nr-map-shape:not(.is-criteria-filtered)")).toHaveCount(4);
  await page.getByRole("button", { name: "กลับจังหวัด", exact: true }).click();
  await expect(page).toHaveURL(/\/drought\?.*horizon=4&irrigation=irrigated/);
  await expect(page.locator(".nr-map-shape:not(.is-criteria-filtered)")).toHaveCount(20);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const plot = (await page.locator(".nr-map-svg").boundingBox())!;
  const controls = (await page.locator(".nr-map-controls").boundingBox())!;
  expect(controls.y).toBeGreaterThanOrEqual(plot.y);
  expect(controls.y + controls.height).toBeLessThanOrEqual(plot.y + plot.height);
  await page.screenshot({ path: testInfo.outputPath("irrigated-forecast.png"), fullPage: true });
  await page.locator('.nr-drought-workspace-map-card').scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("irrigated-map-context.png") });
  expect(errors).toEqual([]);
});

test("overview map owns irrigation; Collecting keeps its forecast and gray category", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.goto("/?target=2025-12");
  const mobile = testInfo.project.name === "mobile";
  if (mobile) {
    await page.getByRole("button", { name: "แก้ไขตัวกรองข้อมูล", exact: true }).click();
    const editor = page.getByRole("dialog", { name: "ตัวกรองข้อมูล", exact: true });
    await expect(editor.getByRole("combobox")).toHaveCount(2);
    await expect(editor.locator(".nr-irrigation-filter")).toHaveCount(0);
    await editor.getByRole("button", { name: "แสดงผล", exact: true }).click();
  }
  const select = page.locator(".nr-map-panel .nr-irrigation-filter").getByRole("combobox");
  await expect(select).toBeVisible();
  const initialUrl = page.url();
  await select.click();
  await page.getByRole("option", { name: "ยังไม่มีข้อมูลชลประทาน", exact: true }).click();
  expect(page.url()).toBe(initialUrl);
  await expect(page.locator(".nr-local-map-filter-status")).toContainText("แสดง 172 จาก 289 ตำบล");
  await expect(page.locator(".nr-map-shape:not(.is-criteria-filtered)")).toHaveCount(172);
  await expect(page.locator(".nr-map-shape.is-forecast-out-of-scope:not(.is-criteria-filtered)").first()).toHaveCSS("fill", "rgb(135, 147, 158)");
  await expect(page.locator(".nr-home-situation")).toContainText("ไม่มีค่าพยากรณ์");
  const expectedHigh = archive.locations.filter((l: any) => l.irrigationStatus === "Collecting" && archive.packedRiskByTargetMonth["2025-12"][l.subdistrictCode][0] === 2).length;
  await expect(page.locator(".nr-forecast-overview-summary .metric-card").filter({ hasText: "เสี่ยงสูง" })).toContainText(`${expectedHigh} ตำบล`);
  const boxes = await page.locator('.nr-map-filter-fields > *').evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().toJSON()));
  expect(boxes[0].right <= boxes[1].left || boxes[0].bottom <= boxes[1].top).toBe(true);
  const triggerBoxes = await page.locator('.nr-map-filter-fields .app-select-trigger').evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().toJSON()));
  if (!mobile) {
    expect(triggerBoxes[0].width).toBeCloseTo(triggerBoxes[1].width, 1);
    expect(triggerBoxes[0].height).toBeCloseTo(triggerBoxes[1].height, 1);
  }
  expect(triggerBoxes[0].right <= triggerBoxes[1].left || triggerBoxes[0].bottom <= triggerBoxes[1].top).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("unknown-irrigation-overview.png"), fullPage: true });
  await page.locator('.nr-dashboard-map-card').scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('unknown-irrigation-map-context.png') });
  await page.locator(".nr-forecast-overview-details").click();
  await expect(page).toHaveURL(/\/drought\?.*irrigation=unknown/);
  await expect(page.locator(".nr-local-map-filter-status")).toContainText("แสดง 172 จาก 289 ตำบล");
});

test("subdistrict mismatch is an empty filter, not zero risk or missing evidence", async ({ page }, testInfo) => {
  await page.goto("/dan-khun-thot/t-300803?target=2025-12&horizon=4&irrigation=irrigated");
  await expect(page.locator(".nr-irrigation-empty")).toContainText("ไม่พบตำบลที่ตรงกับสถานะชลประทานในพื้นที่นี้");
  await expect(page.locator(".nr-drought-workspace-kpis .metric-card")).toHaveCount(0);
  await expect(page.locator(".nr-drought-workspace-chart-card")).toHaveCount(0);
  await expect(page.locator(".nr-map-shape:not(.is-criteria-filtered)")).toHaveCount(0);
  const initialUrl = page.url();
  await page.getByRole("button", { name: "แสดงทุกสถานะชลประทาน", exact: true }).click();
  await expect(page.locator(".nr-drought-workspace-kpis")).toContainText("เสี่ยงปานกลาง");
  await expect(page.locator(".nr-map-shape:not(.is-criteria-filtered)")).toHaveCount(1);
  expect(page.url()).toBe(initialUrl);
  await page.reload();
  await expect(page.locator(".nr-map-shape:not(.is-criteria-filtered)")).toHaveCount(1);
  await expect(page.locator(".nr-map-panel .nr-irrigation-filter").getByRole("combobox")).toContainText("ชลประทาน: ทุกสถานะ");
  await page.locator(".nr-map-panel .nr-irrigation-filter").getByRole("combobox").click();
  await page.getByRole("option", { name: "พึ่งน้ำฝน (ไม่มีชลประทาน)", exact: true }).click();
  await expect(page.locator(".nr-drought-workspace-kpis")).toContainText("เสี่ยงปานกลาง");
  expect(page.url()).toBe(initialUrl);
  await expect(page.locator('.nr-map-shape[data-nr-subdistrict-code="300803"]')).toHaveCSS("fill", "rgb(146, 98, 183)");
  await page.reload();
  await expect(page.locator(".nr-map-panel .nr-irrigation-filter").getByRole("combobox")).toContainText("พึ่งน้ำฝน");
  await expect(page.locator(".nr-map-shape:not(.is-criteria-filtered)")).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("rainfed-subdistrict.png"), fullPage: true });
});

test("all irrigation categories use their own colors; keyboard selection never navigates", async ({ page }, testInfo) => {
  await page.goto('/drought?target=2025-12&horizon=4');
  const initialUrl = page.url();
  await page.getByRole('button', { name: 'ชลประทาน', exact: true }).click();
  for (const [status, count, color] of [['irrigated', 20, 'rgb(57, 127, 197)'], ['rainfed', 97, 'rgb(146, 98, 183)'], ['unknown', 172, 'rgb(135, 147, 158)']] as const) {
    const shapes = page.locator(`.nr-map-shape[data-irrigation-status="${status}"]`);
    await expect(shapes).toHaveCount(count);
    await expect.poll(() => shapes.evaluateAll((elements, expected) => elements.every((element) => getComputedStyle(element).fill === expected), color)).toBe(true);
  }
  const select = page.locator('.nr-map-panel .nr-irrigation-filter').getByRole('combobox');
  await select.click();
  await page.screenshot({ path: testInfo.outputPath('map-irrigation-menu.png') });
  await select.press('Home');
  await select.press('ArrowDown');
  await select.press('Enter');
  await expect(select).toBeFocused();
  await expect(page.locator('.nr-map-shape:not(.is-criteria-filtered)')).toHaveCount(20);
  expect(page.url()).toBe(initialUrl);
  await page.locator('.nr-operational-disclosure > summary').filter({ hasText: 'ความพร้อมข้อมูลพื้นที่' }).click();
  await page.getByRole('button', { name: 'ดูความพร้อมบนแผนที่', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'แผนที่ความพร้อมข้อมูลพื้นที่', exact: true })).toBeVisible();
  await expect(select).toContainText('เข้าถึงชลประทาน');
  await expect(page.locator('.nr-map-shape:not(.is-criteria-filtered)')).toHaveCount(20);
  await select.click();
  await page.getByRole('option', { name: 'พึ่งน้ำฝน (ไม่มีชลประทาน)', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'แผนที่สถานะชลประทาน', exact: true })).toBeVisible();
  await expect(page.locator('.nr-map-shape:not(.is-criteria-filtered)')).toHaveCount(97);
  await expect(page.locator('.nr-drought-workspace-context .is-coverage')).toContainText('/97 ตำบล');
  expect(page.url()).toBe(initialUrl);
  if (testInfo.project.name === 'desktop') {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.locator('.nr-drought-workspace-map-card').scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const rail = page.locator('.nr-local-map-criteria');
    expect(await rail.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('tablet-rainfed-map-context.png') });
  }
});
