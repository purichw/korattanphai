import { readFileSync } from "node:fs";
import { test, expect, seedAuthSession, type Locator } from "./fixtures";
import type { NakhonRatchasimaDroughtForecastArchive } from "../src/types";

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

test.beforeEach(async ({ page }) => { await seedAuthSession(page); });

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
    await page.getByRole("tab", { name: /T\+4/ }).click();
    await expect(countButton).toHaveAttribute("aria-pressed", "true");
    await expect(chart.locator(".nr-forecast-point-group.is-active")).toContainText("T+4");
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
