import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { test, expect, seedAuthSession } from "./fixtures";

const archive = JSON.parse(readFileSync("src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json", "utf8"));
const path = "/dan-khun-thot/t-300806?target=2025-12&horizon=1";
const output = "artifacts/subdistrict-v2";

test.beforeEach(async ({ page }) => {
  await seedAuthSession(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("subdistrict duplicate controls stay synchronized without replacing the map", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(path);
  const map = page.locator(".nr-map-svg");
  await expect(map.locator(".nr-map-shape")).toHaveCount(289);
  await map.evaluate(node => node.setAttribute("data-instance-probe", "same-map"));
  const pageMonth = page.locator(".nr-operational-filters .app-select-field").first().getByRole("combobox");
  const mapMonth = page.getByRole("combobox", { name: "เดือนตั้งต้นบนแผนที่พยากรณ์ภัยแล้ง", exact: true });
  const pageHorizon = page.locator(".nr-operational-horizon-filter").getByRole("combobox");
  const tabs = page.locator(".nr-forecast-archive-horizon-tabs").getByRole("tab");
  const context = page.locator(".nr-drought-workspace-context");
  const home = map.locator('[data-nr-subdistrict-code="300806"]');
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย."];
  for (let index = 0; index < 6; index += 1) {
    await tabs.nth(index).click();
    await expect(pageHorizon).toHaveText(`ล่วงหน้า ${index + 1} เดือน`);
    await expect(context.locator(".is-issue strong")).toHaveText("ธ.ค. 2568");
    await expect(context.locator(".is-target strong")).toHaveText(`${months[index]} 2569`);
    const risk = archive.packedRiskByTargetMonth["2025-12"]["300806"][index];
    const status = risk === 0 ? "no-risk" : risk === 1 ? "moderate" : risk === 2 ? "high" : "out-of-scope";
    await expect(home).toHaveClass(new RegExp(`is-forecast-${status}(?:\\s|$)`));
    await expect(map).toHaveAttribute("data-instance-probe", "same-map");
  }
  await pageHorizon.click();
  await page.getByRole("option", { name: "ล่วงหน้า 4 เดือน", exact: true }).click();
  await expect(tabs.nth(3)).toHaveAttribute("aria-selected", "true");
  await tabs.nth(3).focus();
  await tabs.nth(3).press("ArrowRight");
  await expect(tabs.nth(4)).toBeFocused();
  await expect(pageHorizon).toHaveText("ล่วงหน้า 5 เดือน");
  await tabs.nth(4).press("Home");
  await expect(tabs.nth(0)).toBeFocused();
  await tabs.nth(0).press("End");
  await expect(tabs.nth(5)).toBeFocused();
  await pageMonth.click();
  await page.getByRole("option", { name: "ต.ค. 2568", exact: true }).click();
  await expect(mapMonth).toHaveText("ต.ค. 2568");
  await mapMonth.click();
  await page.getByRole("option", { name: "ธ.ค. 2568", exact: true }).click();
  await expect(pageMonth).toHaveText("ธ.ค. 2568");
  await expect(map).toHaveAttribute("data-instance-probe", "same-map");
  const url = page.url();
  const irrigation = page.getByRole("combobox", { name: "สถานะชลประทาน", exact: true });
  await irrigation.click();
  await page.getByRole("option", { name: "เข้าถึงชลประทาน", exact: true }).click();
  await expect(page.getByText("ไม่พบตำบลที่ตรงกับสถานะชลประทานในพื้นที่นี้", { exact: true })).toBeVisible();
  expect(page.url()).toBe(url);
  await page.getByRole("button", { name: "แสดงทุกสถานะชลประทาน", exact: true }).click();
  await expect(page.locator(".nr-drought-workspace-kpis .metric-card")).toHaveCount(1);
  await page.getByRole("button", { name: "ชลประทาน", exact: true }).click();
  await expect(home).toHaveCSS("fill", "rgb(146, 98, 183)");
  await page.getByRole("button", { name: "ความเสี่ยงภัยแล้ง", exact: true }).click();
  const guidance = page.locator(".nr-operational-guidance");
  await guidance.locator("summary").focus();
  await guidance.locator("summary").press("Enter");
  await expect(guidance).toHaveAttribute("open", "");
  await expect(guidance).not.toContainText("สีกราฟ");
  expect(page.url()).toBe(url);
  await guidance.locator("summary").press("Space");
  await expect(guidance).not.toHaveAttribute("open", "");
  const transform = page.locator(".nr-map-transform-layer");
  await page.getByRole("button", { name: "กลับมุมมองพื้นที่นี้", exact: true }).click();
  const fit = await transform.getAttribute("transform");
  await page.getByRole("button", { name: "ขยายแผนที่", exact: true }).click();
  await expect(transform).not.toHaveAttribute("transform", fit!);
  await page.getByRole("button", { name: "กลับมุมมองพื้นที่นี้", exact: true }).click();
  await expect(transform).toHaveAttribute("transform", fit!);
  await page.getByRole("button", { name: "เปิดแผนที่เต็มจอ", exact: true }).click();
  await expect(page.getByRole("button", { name: "ออกจากเต็มจอ", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "ออกจากเต็มจอ", exact: true }).click();
  await expect(map).toHaveAttribute("data-instance-probe", "same-map");
  await page.reload();
  await expect(pageHorizon).toHaveText("ล่วงหน้า 6 เดือน");
  await expect(pageMonth).toHaveText("ธ.ค. 2568");
  await page.getByRole("button", { name: "กลับอำเภอ", exact: true }).click();
  await expect(page).toHaveURL(url => url.pathname === "/dan-khun-thot" && url.searchParams.get("target") === "2025-12" && url.searchParams.get("horizon") === "6");
  expect(errors).toEqual([]);
});

test("subdistrict inspection layout fits the requested responsive viewports", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "This test explicitly exercises the full viewport matrix.");
  test.setTimeout(90_000);
  await mkdir(output, { recursive: true });
  const measurements = [];
  for (const [width, height] of [[390,844],[393,852],[430,932],[768,1024],[810,1080],[820,1180],[1024,768],[1366,768],[1440,900],[1920,1080]]) {
    await page.setViewportSize({ width, height });
    await page.goto(path);
    await expect(page.locator(".nr-map-shape")).toHaveCount(289);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator(".nr-drought-workspace-chart-card")).toHaveCount(0);
    await expect(page.locator(".nr-map-svg")).toHaveCount(1);
    await expect(page.locator(".nr-forecast-archive-horizon-tabs").getByRole("tab")).toHaveCount(6);
    await expect.poll(() => page.locator('.nr-map-shape[data-nr-subdistrict-code="300806"]').evaluate(node => node.getBoundingClientRect().width)).toBeGreaterThan(100);
    await expect(page.locator(".nr-map-label-layer :is(.is-selected-label,.is-featured-label)").first()).toBeVisible();
    const geometry = await page.evaluate(() => {
      const box = (selector: string) => document.querySelector(selector)!.getBoundingClientRect().toJSON();
      return {
        viewport: { width: innerWidth, height: innerHeight },
        overflow: document.documentElement.scrollWidth > innerWidth,
        map: box(".nr-drought-workspace-map-card"), plot: box(".nr-map-svg"),
        area: box('.nr-map-shape[data-nr-subdistrict-code="300806"]'),
        label: box(".nr-map-label-layer :is(.is-selected-label,.is-featured-label)"),
        intro: box(".nr-subdistrict-forecast-intro"),
        tabs: box(".nr-forecast-archive-horizon-tabs"),
        context: box(".nr-subdistrict-forecast-context"),
        result: box(".nr-drought-workspace-kpis"),
        guidance: box(".nr-operational-guidance"),
        body: box(".nr-drought-workspace-body"),
      };
    });
    expect(geometry.overflow).toBe(false);
    expect(geometry.tabs.width).toBeCloseTo(geometry.intro.width, 0);
    expect(geometry.label.height).toBeGreaterThan(11);
    expect(geometry.area.width).toBeGreaterThan(geometry.plot.width * .28);
    expect(geometry.area.x).toBeGreaterThanOrEqual(geometry.plot.x);
    expect(geometry.area.y).toBeGreaterThanOrEqual(geometry.plot.y);
    expect(geometry.area.right).toBeLessThanOrEqual(geometry.plot.right);
    expect(geometry.area.bottom).toBeLessThanOrEqual(geometry.plot.bottom);
    if (width >= 768) {
      expect(geometry.map.width / geometry.body.width).toBeGreaterThan(.6);
      expect(geometry.map.width / geometry.body.width).toBeLessThan(.71);
      expect(geometry.context.x).toBeGreaterThan(geometry.map.right);
      expect(geometry.result.y).toBeCloseTo(geometry.intro.y, 0);
      expect(geometry.guidance.x).toBeCloseTo(geometry.context.x, 0);
      expect(geometry.guidance.bottom).toBeCloseTo(geometry.map.bottom, 0);
    } else {
      expect(geometry.intro.bottom).toBeLessThan(geometry.context.y);
      expect(geometry.context.bottom).toBeLessThan(geometry.result.y);
      expect(geometry.result.bottom).toBeLessThan(geometry.map.y);
      expect(geometry.map.bottom).toBeLessThan(geometry.guidance.y);
    }
    await page.screenshot({ path: `${output}/subdistrict-${width}x${height}.png`, fullPage: true });
    measurements.push(geometry);
  }
  await writeFile(`${output}/geometry.json`, JSON.stringify(measurements, null, 2));
});
