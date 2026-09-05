import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import archiveJson from "../src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev02.json";
import type { NakhonRatchasimaDroughtForecastArchive } from "../src/types";
import { getNakhonRatchasimaResearchPanelSummary } from "../src/domain";
import { forecastArchiveSummaryForSelection, forecastArchiveTrendMonthsForSelection } from "../src/components/nakhon-ratchasima/forecastModel";
import { DroughtForecastTrendGraph, DroughtForecastWorkspaceKpiStrip } from "../src/components/nakhon-ratchasima/DroughtForecastWorkspace";
import { ResearchDroughtSituationPanel } from "../src/components/nakhon-ratchasima/ResearchPanels";
import { DroughtForecastArchiveSummaryMetrics } from "../src/components/nakhon-ratchasima/ForecastControls";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const archive = archiveJson as unknown as NakhonRatchasimaDroughtForecastArchive;

it.each(["province", "district", "subdistrict"])("keeps the %s threshold label outside the plot at the same reference value", (level) => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  const month = archive.targetMonths.find((item) => item.period === "2025-12")!;
  const codes = level === "province" ? undefined : level === "subdistrict" ? ["300806"]
    : archive.locations.filter((item) => item.districtCode === "3008").map((item) => item.subdistrictCode);
  const months = forecastArchiveTrendMonthsForSelection(archive, month, codes);
  const total = months[0].totalSubdistricts;
  const threshold = Math.round(total * 0.5);
  const { container } = render(<DroughtForecastTrendGraph months={months} totalSubdistricts={total} singleSubdistrict={level === "subdistrict"} />);
  const label = screen.getByText(level === "subdistrict" ? "เส้นอ้างอิงเมื่อพบความเสี่ยง" : `เกณฑ์ครึ่งพื้นที่ ${threshold} ตำบล`);
  expect(label.closest("figcaption")).not.toBeNull();
  expect(label.closest("svg")).toBeNull();
  const line = container.querySelector(".nr-drought-forecast-graph-threshold")!;
  const [, , , height] = container.querySelector("svg")!.getAttribute("viewBox")!.split(" ").map(Number);
  const expectedY = 28 + (1 - threshold / total) * (height - 28 - 52);
  expect(Number(line.getAttribute("y1"))).toBeCloseTo(expectedY);
  expect(line.getAttribute("y2")).toBe(line.getAttribute("y1"));
  expect(container.querySelectorAll(".nr-drought-forecast-point")).toHaveLength(6);
});

it.each([false, true])("reserves space below zero-value points for X-axis labels (compact: %s)", (compact) => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: compact, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  const months = forecastArchiveTrendMonthsForSelection(archive, archive.targetMonths[0]);
  const { container } = render(<DroughtForecastTrendGraph months={months} totalSubdistricts={289} activeHorizon={1} />);
  const zeroGuide = [...container.querySelectorAll(".nr-forecast-graph-guide")].find((guide) => guide.querySelector("text")!.textContent === "0")!;
  const zeroY = Number(zeroGuide.querySelector("line")!.getAttribute("y1"));
  const labels = container.querySelectorAll(".nr-forecast-axis-date");
  expect(labels).toHaveLength(6);
  for (const label of labels) expect(Number(label.getAttribute("y")) - zeroY).toBeGreaterThanOrEqual(38);
});

it("renders missing and out-of-scope as separate shared stat cards", () => {
  const month = archive.targetMonths.find((item) => item.period === "2025-12")!;
  const outside = archive.locations.find((item) => archive.packedRiskByTargetMonth[month.period][item.subdistrictCode][0] === null)!;
  const summary = forecastArchiveSummaryForSelection(archive, month, 1, ["300806", outside.subdistrictCode, "missing"]);
  render(<DroughtForecastWorkspaceKpiStrip level="district" summary={summary} />);
  const stats = screen.getByRole("group", { name: "สรุปค่าพยากรณ์ที่เลือก" });
  for (const label of ["เสี่ยงปานกลาง", "นอกขอบเขต", "ไม่มีข้อมูล"]) {
    const card = within(stats).getByText(label).closest(".metric-card")!;
    expect(within(card as HTMLElement).getByText("1 ตำบล")).toBeInTheDocument();
  }
  expect(within(stats).getByText("67% มีรายการพยากรณ์")).toBeInTheDocument();
});

it("does not show an empty historical dataset as normal conditions", () => {
  render(<ResearchDroughtSituationPanel research={getNakhonRatchasimaResearchPanelSummary()} />);
  expect(screen.queryByText("ปกติเดือนล่าสุด")).not.toBeInTheDocument();
  expect(screen.getByText(/ข้อมูลว่างไม่เท่ากับความเสี่ยงต่ำ/)).toBeInTheDocument();
});

it("does not color an unmatched overview forecast as no risk", () => {
  const month = archive.targetMonths.find((item) => item.period === "2025-12")!;
  const summary = forecastArchiveSummaryForSelection(archive, month, 1, ["missing"]);
  render(<DroughtForecastArchiveSummaryMetrics level="province" variant="overview" summary={summary} />);
  expect(screen.getByText("ไม่มีความเสี่ยง").closest(".metric-card")).toHaveClass("is-muted");
  expect(screen.getByText("ไม่มีข้อมูลในรอบนี้")).toBeVisible();
});
