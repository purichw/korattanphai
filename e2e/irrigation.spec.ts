import { test, expect, seedAuthSession } from "./fixtures";
import { readFileSync } from "node:fs";

const archive = JSON.parse(readFileSync("src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev02.json", "utf8"));
const overview = JSON.parse(readFileSync("src/data/generated/forecast-overview-t1.json", "utf8"));

test.beforeEach(async ({ page }) => {
  await page.route("https://ktp-auth-test.supabase.co/rest/v1/rpc/ktp_load_forecast_archive", (route) => route.fulfill({ json: route.request().postDataJSON().p_horizon_count === 1 ? overview : archive }));
  await seedAuthSession(page);
});

test("irrigation filters map, totals and horizons and survives district navigation", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/drought?target=2025-12&horizon=1");
  const select = page.locator(".nr-operational-filters .nr-irrigation-filter").getByRole("combobox");
  await select.click();
  await page.getByRole("option", { name: "เข้าถึงชลประทาน", exact: true }).click();
  await expect(page.locator(".nr-irrigation-scope")).toContainText("ตรงกับตัวกรอง 20 ตำบล");
  await expect(page.locator(".nr-map-shape:not(.is-criteria-filtered)")).toHaveCount(20);
  await expect(page.locator(".nr-drought-workspace-context .is-coverage")).toContainText("/20 ตำบล");
  await page.getByRole("combobox", { name: "สถานะพยากรณ์ภัยแล้ง", exact: true }).click();
  await page.getByRole("option", { name: "เสี่ยงสูง", exact: true }).click();
  const expectedHigh = archive.locations.filter((l: any) => l.irrigationStatus === "Irrigation" && archive.packedRiskByTargetMonth["2025-12"][l.subdistrictCode][0] === 2).length;
  await expect(page.locator(".nr-map-shape:not(.is-criteria-filtered)")).toHaveCount(expectedHigh);
  await page.getByRole("button", { name: "รีเซ็ต", exact: true }).click();
  await expect(page.locator(".nr-map-shape:not(.is-criteria-filtered)")).toHaveCount(20);
  await expect(select).toContainText("เข้าถึงชลประทาน");
  await page.getByRole("tab", { name: /T\+4/ }).click();
  await expect(page).toHaveURL(/irrigation=irrigated/);
  await expect(page).toHaveURL(/horizon=4/);
  await page.reload();
  await expect(select).toContainText("เข้าถึงชลประทาน");
  await expect(page.locator(".nr-map-shape:not(.is-criteria-filtered)")).toHaveCount(20);
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
  expect(errors).toEqual([]);
});

test("overview Collecting is unknown irrigation, not missing forecast; mobile editor stays open", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.goto("/?target=2025-12");
  const mobile = testInfo.project.name === "mobile";
  if (mobile) await page.getByRole("button", { name: "แก้ไขตัวกรองข้อมูล", exact: true }).click();
  const surface = mobile ? page.getByRole("dialog", { name: "ตัวกรองข้อมูล", exact: true }) : page.locator(".operational-filter-fields");
  await surface.locator(".nr-irrigation-filter").getByRole("combobox").click();
  await page.getByRole("option", { name: "ยังไม่มีข้อมูลชลประทาน", exact: true }).click();
  if (mobile) {
    await expect(surface).toBeVisible();
    await surface.getByRole("button", { name: "แสดงผล", exact: true }).click();
  }
  await expect(page.locator(".nr-irrigation-scope")).toContainText("172 ตำบล");
  await expect(page.locator(".nr-map-shape:not(.is-criteria-filtered)")).toHaveCount(172);
  await expect(page.locator(".nr-home-situation")).toContainText("พบพื้นที่เสี่ยง");
  const expectedHigh = archive.locations.filter((l: any) => l.irrigationStatus === "Collecting" && archive.packedRiskByTargetMonth["2025-12"][l.subdistrictCode][0] === 2).length;
  await expect(page.locator(".nr-forecast-overview-summary .metric-card").filter({ hasText: "เสี่ยงสูง" })).toContainText(`${expectedHigh} ตำบล`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("unknown-irrigation-overview.png"), fullPage: true });
  await page.locator(".nr-forecast-overview-details").click();
  await expect(page).toHaveURL(/\/drought\?.*irrigation=unknown/);
  await expect(page.locator(".nr-irrigation-scope")).toContainText("172 ตำบล");
});

test("subdistrict mismatch is an empty filter, not zero risk or missing evidence", async ({ page }, testInfo) => {
  await page.goto("/dan-khun-thot/t-300803?target=2025-12&horizon=4&irrigation=irrigated");
  await expect(page.locator(".nr-irrigation-empty")).toContainText("ไม่พบตำบลที่ตรงกับสถานะชลประทานในพื้นที่นี้");
  await expect(page.locator(".nr-drought-workspace-kpis .metric-card")).toHaveCount(0);
  await expect(page.locator(".nr-drought-workspace-chart-card")).toHaveCount(0);
  await expect(page.locator(".nr-map-shape:not(.is-criteria-filtered)")).toHaveCount(0);
  await page.getByRole("button", { name: "แสดงทุกสถานะชลประทาน", exact: true }).click();
  await expect(page.locator(".nr-drought-workspace-kpis")).toContainText("เสี่ยงปานกลาง");
  await expect(page.locator(".nr-map-shape:not(.is-criteria-filtered)")).toHaveCount(1);
  await expect(page).not.toHaveURL(/irrigation=/);
  await page.locator(".nr-operational-filters .nr-irrigation-filter").getByRole("combobox").click();
  await page.getByRole("option", { name: "พึ่งน้ำฝน (ไม่มีชลประทาน)", exact: true }).click();
  await expect(page.locator(".nr-drought-workspace-kpis")).toContainText("เสี่ยงปานกลาง");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("rainfed-subdistrict.png"), fullPage: true });
});
