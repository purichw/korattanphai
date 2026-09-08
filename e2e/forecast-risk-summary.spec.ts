import { mkdirSync, readFileSync } from "node:fs";
import { test, expect, seedAuthSession, type Locator } from "./fixtures";
import type { NakhonRatchasimaDroughtForecastArchive } from "../src/types";
import { forecastSlice } from "../tests/fixtures/forecast-slice.mjs";

const archive = JSON.parse(readFileSync("src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json", "utf8")) as NakhonRatchasimaDroughtForecastArchive;
const source = archive.packedRiskByTargetMonth["2025-12"];
const percent = (value: number) => `${value.toLocaleString("th-TH", { maximumFractionDigits: 1 })}%`;

async function expectSeries(chart: Locator, codes: string[], unit: "count" | "percent") {
  await expect(chart.locator("figure")).toHaveAttribute("data-unit", unit);
  const columns = chart.locator(".nr-forecast-point-group");
  await expect(columns).toHaveCount(6);
  for (let h = 0; h < 6; h++) {
    const risks = codes.map(code => source[code]?.[h]);
    const moderate = risks.filter(risk => risk === 1).length;
    const high = risks.filter(risk => risk === 2).length;
    const inScope = risks.filter(risk => risk === 0 || risk === 1 || risk === 2).length;
    const expected = !inScope ? "ไม่มีค่า" : unit === "count" ? String(moderate + high) : percent((moderate + high) / inScope * 100);
    await expect(columns.nth(h).locator(".nr-drought-forecast-point-label")).toHaveText(expected);
    for (const [level, count] of [["moderate", moderate], ["high", high]] as const) {
      const bar = columns.nth(h).locator(`.nr-drought-forecast-bar.is-${level}`);
      if (count > 0) await expect(bar).toHaveAttribute("data-count", String(count));
      else await expect(bar).toHaveCount(0);
    }
  }
}

test.beforeEach(async ({ page }) => {
  await page.route("https://ktp-auth-test.supabase.co/rest/v1/rpc/ktp_load_forecast_slice", route => {
    expect(route.request().postDataJSON().p_horizon_count).toBe(6);
    return route.fulfill({ json: forecastSlice(archive, route.request().postDataJSON()) });
  });
  await seedAuthSession(page);
});

test("shared bar graph reference layout and details across six viewports", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const mobile = testInfo.project.name === "mobile";
  const sizes = mobile ? [[390, 844], [393, 852], [430, 932]] : [[1366, 768], [1440, 900], [1920, 1080]];
  const errors: string[] = [];
  let requests = 0;
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => { if (request.url().includes("ktp_load_forecast_slice")) requests++; });
  await page.goto("/soeng-sang?target=2025-12&horizon=1");
  const chart = page.locator(".nr-drought-workspace-chart-card");
  const codes = archive.locations.filter(location => location.districtCode === "3003").map(location => location.subdistrictCode);
  await expectSeries(chart, codes, "percent");
  const loadedRequests = requests;
  const initialUrl = page.url();
  const mapClasses = await page.locator(".nr-map-shape").evaluateAll(shapes => shapes.map(shape => shape.getAttribute("class")));
  mkdirSync("artifacts/bar-graph-v1", { recursive: true });
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await chart.scrollIntoViewIfNeeded();
    await page.evaluate(() => document.fonts.ready);
    await expect(chart.locator("figcaption > span")).toHaveCount(4);
    await expect.poll(() => chart.locator(".nr-forecast-bar-plot").evaluate(plot => Math.abs(plot.clientWidth - plot.querySelector("svg")!.viewBox.baseVal.width))).toBeLessThan(2);
    const layout = await chart.evaluate(element => {
      const rect = element.getBoundingClientRect();
      const toggle = element.querySelector(".nr-forecast-unit-control")!.getBoundingClientRect();
      const plot = element.querySelector(".nr-forecast-bar-plot")!.getBoundingClientRect();
      const legend = element.querySelector("figcaption")!.getBoundingClientRect();
      const note = element.querySelector(".nr-forecast-coverage-note")!.getBoundingClientRect();
      const labels = [...element.querySelectorAll(".nr-forecast-axis-date, .nr-drought-forecast-point-label")].map(label => label.getBoundingClientRect());
      return { overflow: element.scrollWidth > element.clientWidth, toggleRatio: toggle.width / (rect.width - 20), plotHeight: plot.height,
        overlap: labels.some(label => label.left < plot.left || label.right > plot.right || label.bottom > legend.top), footerInside: note.bottom <= rect.bottom,
        documentOverflow: document.documentElement.scrollWidth > innerWidth };
    });
    expect(layout).toMatchObject({ overflow: false, overlap: false, footerInside: true, documentOverflow: false });
    expect(layout.toggleRatio).toBeGreaterThan(.97);
    expect(layout.plotHeight).toBeGreaterThan(180);
    expect(await chart.locator("figcaption > span").evaluateAll(items => items.every(item =>
      getComputedStyle(item.querySelector(".nr-legend-short")!).display === "none" ||
      getComputedStyle(item.querySelector(".nr-legend-full")!).position === "absolute",
    ))).toBe(true);
    expect(await chart.locator(".nr-drought-forecast-point-label").evaluateAll(labels => labels.slice(1).every((label, index) =>
      labels[index].getBoundingClientRect().right < label.getBoundingClientRect().left,
    ))).toBe(true);
    await chart.screenshot({ path: `artifacts/bar-graph-v1/${width}-chart.png` });
    if (width === 1440 || width === 390) {
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: `artifacts/bar-graph-v1/${width}-page.png`, fullPage: true });
      await chart.scrollIntoViewIfNeeded();
    }
    const column = chart.getByRole("button", { name: /รายละเอียดล่วงหน้า 6/ });
    if (mobile) await column.tap();
    else {
      await column.focus(); await column.press("Enter");
      expect(await column.evaluate(element => getComputedStyle(element).outlineStyle)).toBe("solid");
    }
    const tooltip = chart.getByRole("tooltip");
    await expect(tooltip).toContainText("6 เดือน");
    await expect(tooltip).toContainText("มีค่าพยากรณ์ 4/6 ตำบล");
    const bounds = await tooltip.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    await tooltip.screenshot({ path: `artifacts/bar-graph-v1/${width}-detail.png` });
    if (mobile) await chart.getByRole("heading").tap();
    else await page.keyboard.press("Escape");
    await expect(tooltip).toHaveCount(0);
    await chart.getByRole("button", { name: "จำนวนตำบล", exact: true }).click();
    await expectSeries(chart, codes, "count");
    await chart.getByRole("button", { name: "เปอร์เซ็นต์", exact: true }).click();
    await expectSeries(chart, codes, "percent");
  }
  expect(requests).toBe(loadedRequests);
  expect(page.url()).toBe(initialUrl);
  expect(await page.locator(".nr-map-shape").evaluateAll(shapes => shapes.map(shape => shape.getAttribute("class")))).toEqual(mapClasses);
  expect(errors).toEqual([]);
});

test("shared bar graph preserves loading and unavailable states", async ({ page }, testInfo) => {
  const databaseMode = process.env.PLAYWRIGHT_DATA_BACKEND === "supabase";
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  if (databaseMode) await page.route("https://ktp-auth-test.supabase.co/rest/v1/rpc/ktp_load_forecast_slice", async route => {
    await pending;
    await route.fulfill({ json: forecastSlice(archive, route.request().postDataJSON()) });
  });
  try {
    await page.goto("/chok-chai?target=2025-12&horizon=1");
    mkdirSync("artifacts/bar-graph-v1", { recursive: true });
    let height: number | undefined;
    if (databaseMode) {
      const loading = page.locator(".nr-loading-chart");
      await expect(loading).toBeVisible();
      height = (await loading.boundingBox())!.height;
      await expect(loading.locator(".nr-drought-forecast-bar, .nr-drought-forecast-zero")).toHaveCount(0);
      await loading.screenshot({ path: `artifacts/bar-graph-v1/${testInfo.project.name}-loading.png` });
    }
    release();
    const chart = page.locator(".nr-drought-workspace-chart-card");
    await expect(chart.getByRole("status")).toContainText("ไม่มีค่าพยากรณ์ให้เปรียบเทียบ");
    await expect(chart.locator(".nr-drought-forecast-bar, .nr-drought-forecast-zero")).toHaveCount(0);
    if (height !== undefined) expect((await chart.boundingBox())!.height).toBeCloseTo(height, 0);
    await chart.screenshot({ path: `artifacts/bar-graph-v1/${testInfo.project.name}-empty.png` });
  } finally { release(); }
});

for (const [level, path] of [["province", "/drought"], ["district", "/dan-khun-thot"]] as const) {
  test(`${level} graph separates source risk levels in both units and retains scope`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const locations = archive.locations.filter(location => level === "province" || location.districtCode === "3008");
    await page.goto(`${path}?target=2025-12&horizon=1`);
    const chart = page.locator(".nr-drought-workspace-chart-card");
    const initialUrl = page.url();
    const historyLength = await page.evaluate(() => history.length);
    await expectSeries(chart, locations.map(location => location.subdistrictCode), "percent");
    await expect(chart.getByRole("button", { name: "เปอร์เซ็นต์", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(chart.locator(".nr-drought-forecast-graph-threshold, .is-severe")).toHaveCount(0);
    if (level === "district") {
      await expect(page.locator(".nr-drought-workspace-kpis .is-coverage")).toContainText("6/16 ตำบล");
      await expect(page.locator(".nr-drought-workspace-kpis .is-moderate")).toContainText("100% ของตำบลที่มีค่าพยากรณ์");
      await expect(page.locator(".nr-operational-forecast-summary")).toContainText("เสี่ยง 6 จาก 6 ตำบลที่มีค่าพยากรณ์");
    }
    const mapClasses = await page.locator(".nr-map-shape").evaluateAll(shapes => shapes.map(shape => shape.getAttribute("class")));
    const plotFrame = () => chart.locator("svg.nr-forecast-line-svg").evaluate(svg => {
      const plot = svg.getBoundingClientRect();
      return { top: plot.top - svg.closest("section")!.getBoundingClientRect().top, height: plot.height };
    });
    const percentPlot = await plotFrame();
    const countButton = chart.getByRole("button", { name: "จำนวนตำบล", exact: true });
    await countButton.focus();
    await countButton.press("Enter");
    await expect(countButton).toBeFocused();
    await expectSeries(chart, locations.map(location => location.subdistrictCode), "count");
    const countPlot = await plotFrame();
    expect(countPlot.top).toBeCloseTo(percentPlot.top, 0);
    expect(countPlot.height).toBeCloseTo(percentPlot.height, 0);
    expect(page.url()).toBe(initialUrl);
    expect(await page.evaluate(() => history.length)).toBe(historyLength);
    expect(await page.locator(".nr-map-shape").evaluateAll(shapes => shapes.map(shape => shape.getAttribute("class")))).toEqual(mapClasses);
    await page.getByRole("tab", { name: /ล่วงหน้า 4 เดือน/ }).click();
    await expect(countButton).toHaveAttribute("aria-pressed", "true");
    await expect(chart.locator(".nr-forecast-point-group.is-active")).toContainText("4 เดือน");
    const horizonUrl = page.url();
    await page.locator(".nr-map-panel .nr-irrigation-filter").getByRole("combobox").click();
    await page.getByRole("option", { name: "พึ่งน้ำฝน (ไม่มีชลประทาน)", exact: true }).click();
    const rainfedCodes = locations.filter(location => location.irrigationStatus === "RainFed").map(location => location.subdistrictCode);
    await expectSeries(chart, rainfedCodes, "count");
    await chart.getByRole("button", { name: "เปอร์เซ็นต์", exact: true }).click();
    await expectSeries(chart, rainfedCodes, "percent");
    expect(page.url()).toBe(horizonUrl);
    await expect(page.locator(".nr-map-shape:not(.is-criteria-filtered)")).toHaveCount(rainfedCodes.length);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await chart.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    const overlaps = await chart.locator(".nr-drought-forecast-point-label").evaluateAll(labels => labels.slice(1).some((label, index) => labels[index].getBoundingClientRect().right > label.getBoundingClientRect().left));
    expect(overlaps).toBe(false);
    expect(errors).toEqual([]);
  });
}
