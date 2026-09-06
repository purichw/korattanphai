import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import archiveJson from "../src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev02.json";
import type { NakhonRatchasimaDroughtForecastArchive } from "../src/types";
import { getNakhonRatchasimaDistrictByCode, getNakhonRatchasimaResearchPanelSummary } from "../src/domain";
import { droughtForecastBand, droughtForecastBandLabel, forecastArchiveSummaryForSelection, forecastArchiveTrendMonthsForSelection } from "../src/components/nakhon-ratchasima/forecastModel";
import { DroughtForecastTrendGraph, DroughtForecastWorkspaceKpiStrip, DroughtForecastWorkspaceChart } from "../src/components/nakhon-ratchasima/DroughtForecastWorkspace";
import { PredictionReadinessPanel, ResearchDroughtSituationPanel, ResearchAreaHeading, ResearchAreaSituationPanel, ResearchSubdistrictDataGapPanel, ResearchAreaAgricultureImpactPanel, ResearchAreaAttentionPanel } from "../src/components/nakhon-ratchasima/ResearchPanels";
import { localResearchPeriodForSelectedMonth, predictionReadinessSummaryForSubdistrictCodes, summarizeResearchAreaRecords } from "../src/components/nakhon-ratchasima/workspaceModel";
import { DroughtForecastArchiveSummaryMetrics } from "../src/components/nakhon-ratchasima/ForecastControls";
import { DroughtOperationalDisclosure, DroughtOperationalSummary } from "../src/components/nakhon-ratchasima/DroughtOperationalWorkspace";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const archive = archiveJson as unknown as NakhonRatchasimaDroughtForecastArchive;

it.each([
  [142, 142, "has-risk", "พบตำบลเสี่ยง 142 ตำบล"],
  [0, 4, "is-default", "พบตำบลเสี่ยง 0 ตำบล"],
  [0, 0, "has-no-data", "ไม่มีค่าพยากรณ์ในรอบนี้"],
] as const)("shares the operational MetricCard without changing risk/availability (%i/%i)", (risk, inScope, state, value) => {
  const { container } = render(<DroughtOperationalSummary horizon={4} riskSubdistricts={risk} inScopeSubdistricts={inScope} />);
  expect(container.firstChild).toHaveClass("metric-card", "nr-operational-card-heading", state);
  expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("สรุปผลพยากรณ์ (T+4)");
  expect(screen.getByText(value)).toHaveClass("metric-card-value");
  expect(screen.getByText(`จากตำบลที่มีค่าพยากรณ์ ${inScope} ตำบล`)).toHaveClass("metric-card-detail");
  expect(screen.queryByRole("button")).toBeNull();
});

it("centers short operational disclosure copy and supports explicit long-description alignment", () => {
  const description = "ตรวจสอบข้อมูลพื้นที่ก่อนตัดสินใจ";
  const { container, rerender } = render(<DroughtOperationalDisclosure title="คำแนะนำ" description={description}><p>คำอธิบายรายละเอียด</p></DroughtOperationalDisclosure>);
  expect(container.querySelector("summary")).toHaveClass("nr-operational-card-heading");
  expect(screen.getByText(description)).toHaveClass("is-center");
  expect(container.querySelector("details")).not.toHaveAttribute("open");
  rerender(<DroughtOperationalDisclosure title="คำแนะนำ" description={description} descriptionAlign="start"><p>คำอธิบายรายละเอียด</p></DroughtOperationalDisclosure>);
  expect(screen.getByText(description)).toHaveClass("is-start");
  expect(container.querySelector(".nr-operational-disclosure-body p")).toHaveTextContent("คำอธิบายรายละเอียด");
});

it.each(["province", "district", "subdistrict"])("keeps the %s threshold label outside the plot at the same reference value", (level) => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  const month = archive.targetMonths.find((item) => item.period === "2025-12")!;
  const codes = level === "province" ? undefined : level === "subdistrict" ? ["300806"]
    : archive.locations.filter((item) => item.districtCode === "3008").map((item) => item.subdistrictCode);
  const months = forecastArchiveTrendMonthsForSelection(archive, month, codes);
  const total = months[0].totalSubdistricts;
  const threshold = Math.round(total * 0.5);
  const { container } = render(<DroughtForecastTrendGraph months={months} totalSubdistricts={total} singleSubdistrict={level === "subdistrict"} />);
  const label = screen.getByText(level === "subdistrict" ? "เส้นอ้างอิงเมื่อพบความเสี่ยง" : `เส้นอ้างอิงครึ่งจำนวนตำบล (${threshold} ตำบลขึ้นไป)`);
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
  for (const [index, label] of [...labels].entries()) {
    const [horizonLabel, monthLabel] = label.querySelectorAll("tspan");
    expect(horizonLabel.textContent).toBe(`T+${index + 1}`);
    expect(Number(label.getAttribute("y")) - zeroY).toBeGreaterThanOrEqual(24);
    expect(Number(label.getAttribute("y")) + Number(monthLabel.getAttribute("dy")) - zeroY).toBeGreaterThanOrEqual(40);
    expect(monthLabel.textContent).toContain(months[index].labelTh.slice(0, 4));
  }
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
  expect(within(stats).getByText("33% ของจำนวนตำบลทั้งหมด")).toBeInTheDocument();
});

it("preserves coverage at every archive horizon, including all-null scopes", () => {
  for (const month of archive.targetMonths) {
    for (const district of new Set(archive.locations.map((item) => item.districtCode))) {
      const codes = archive.locations.filter((item) => item.districtCode === district).map((item) => item.subdistrictCode);
      for (const point of forecastArchiveTrendMonthsForSelection(archive, month, codes)) {
        expect(point.inScopeSubdistricts + point.outOfScopeSubdistricts + point.missingSubdistricts).toBe(codes.length);
        expect(droughtForecastBand(point) === "unavailable").toBe(point.inScopeSubdistricts === 0);
        expect(point.riskSubdistricts + point.normalSubdistricts).toBe(point.inScopeSubdistricts);
      }
    }
  }
});

it("does not draw an all-null scope as a green zero series", () => {
  const month = archive.targetMonths.find((item) => item.period === "2025-12")!;
  const months = forecastArchiveTrendMonthsForSelection(archive, month, ["300101"]);
  const { container } = render(<DroughtForecastWorkspaceChart trendMonths={months} selectedHorizon={1} scopeLabel="ต.ในเมือง" coverageRemark="นอกขอบเขต 1 ตำบล" />);
  expect(screen.getByRole("status")).toHaveTextContent("ไม่มีค่าพยากรณ์ให้เปรียบเทียบ");
  expect(container.querySelector(".nr-drought-forecast-point")).toBeNull();
});

it("does not connect or fill across unavailable horizons", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  const month = archive.targetMonths.find((item) => item.period === "2025-12")!;
  const fixture = { ...archive, packedRiskByTargetMonth: { [month.period]: { "300806": [0, null, 1, 2, 0, 0] } } } as NakhonRatchasimaDroughtForecastArchive;
  const months = forecastArchiveTrendMonthsForSelection(fixture, month, ["300806"]);
  const { container } = render(<DroughtForecastTrendGraph months={months} totalSubdistricts={1} />);
  expect(container.querySelectorAll(".nr-drought-forecast-point")).toHaveLength(5);
  expect(container.querySelectorAll(".nr-drought-forecast-line-segment")).toHaveLength(3);
  expect(container.querySelectorAll(".nr-drought-forecast-graph-area")).toHaveLength(3);
  expect(container.querySelectorAll(".nr-drought-forecast-point.is-normal")).toHaveLength(3);
  expect(screen.getByText("ไม่มีค่า")).toBeInTheDocument();
  expect(container.textContent).not.toContain("T+1 · T+1");
});

it("labels exactly half as at least half of tambon count, not land area", () => {
  const month = archive.targetMonths.find((item) => item.period === "2025-12")!;
  const codes = archive.locations.filter((item) => item.districtSlug === "khon-buri").map((item) => item.subdistrictCode);
  const point = forecastArchiveTrendMonthsForSelection(archive, month, codes)[0];
  expect(point.riskSubdistricts).toBe(6);
  expect(point.totalSubdistricts).toBe(12);
  expect(droughtForecastBandLabel(droughtForecastBand(point))).toBe("เสี่ยงตั้งแต่ครึ่งหนึ่งของจำนวนตำบล");
});

it.each([0, 1, 2, null, undefined])("shows one status, not population counts, for a tambon with risk %s", (risk) => {
  const month = archive.targetMonths.find((item) => item.period === "2025-12")!;
  const fixture = { ...archive, packedRiskByTargetMonth: { [month.period]: risk === undefined ? {} : { "300806": [risk, risk, risk, risk, risk, risk] } } } as NakhonRatchasimaDroughtForecastArchive;
  const summary = forecastArchiveSummaryForSelection(fixture, month, 1, ["300806"]);
  const { container } = render(<DroughtForecastWorkspaceKpiStrip level="subdistrict" summary={summary} selectedRecord={summary.recordsBySubdistrict.get("300806")} />);
  expect(container.querySelectorAll(".metric-card")).toHaveLength(1);
  expect(container.textContent).not.toMatch(/1\/1|0 ตำบล|100%/);
  if (risk === null || risk === undefined) expect(container.querySelector(".metric-card")).toHaveClass("is-muted");
});

it("attaches the readiness percentage to the ready category and uses a single-area status", () => {
  const codes = archive.locations.filter((item) => item.districtCode === "3008").map((item) => item.subdistrictCode);
  const readiness = predictionReadinessSummaryForSubdistrictCodes(codes);
  const { rerender, container } = render(<PredictionReadinessPanel readiness={readiness} onOpenMap={() => {}} compact />);
  expect(container.textContent).toContain("พร้อมระดับพื้นที่ 0% ของจำนวนตำบลทั้งหมด");
  expect(container.textContent).not.toContain("มีข้อมูลตั้งต้น · ประมาณ 0%");
  expect(container.textContent).toContain("ไม่ใช่ความครบถ้วนหรือความแม่นยำของคลังพยากรณ์ Excel");
  rerender(<PredictionReadinessPanel readiness={predictionReadinessSummaryForSubdistrictCodes(["300806"])} onOpenMap={() => {}} scope="single" />);
  expect(container.querySelector(".nr-readiness-gauge, .nr-readiness-breakdown-list")).toBeNull();
  expect(screen.getByRole("group", { name: "สถานะหลักฐานของตำบล" })).toBeInTheDocument();
});

it("does not show an empty historical dataset as normal conditions", () => {
  render(<ResearchDroughtSituationPanel research={getNakhonRatchasimaResearchPanelSummary()} />);
  expect(screen.queryByText("ปกติเดือนล่าสุด")).not.toBeInTheDocument();
  expect(screen.getByText(/ข้อมูลว่างไม่เท่ากับความเสี่ยงต่ำ/)).toBeInTheDocument();
});

it("keeps unavailable quality checks neutral and hides empty area designs", () => {
  const district = getNakhonRatchasimaDistrictByCode("3008")!;
  const stats = summarizeResearchAreaRecords([], district.subdistricts.length);
  const activePeriod = localResearchPeriodForSelectedMonth("2025-12", getNakhonRatchasimaResearchPanelSummary());
  const { container } = render(<>
    <ResearchAreaHeading district={district} stats={stats} activePeriod={activePeriod} />
    <ResearchAreaSituationPanel district={district} stats={stats} activePeriod={activePeriod} />
    <ResearchSubdistrictDataGapPanel stats={stats} activePeriod={activePeriod} />
    <ResearchAreaAgricultureImpactPanel district={district} stats={stats} activePeriod={activePeriod} />
    <ResearchAreaAttentionPanel district={district} period={activePeriod.period} onNavigate={() => {}} />
  </>);
  for (const value of screen.getAllByText("ยังตรวจสอบไม่ได้")) expect(value.closest(".metric-card")).toHaveClass("is-muted");
  expect(container.textContent).not.toContain("ครอบคลุมทุกพื้นที่");
  expect(container.querySelector(".nr-agri-impact-module, .nr-area-watchlist-section")).toBeNull();
});

it("does not color an unmatched overview forecast as no risk", () => {
  const month = archive.targetMonths.find((item) => item.period === "2025-12")!;
  const summary = forecastArchiveSummaryForSelection(archive, month, 1, ["missing"]);
  render(<DroughtForecastArchiveSummaryMetrics level="province" variant="overview" summary={summary} />);
  expect(screen.getByText("ไม่มีความเสี่ยง").closest(".metric-card")).toHaveClass("is-muted");
  expect(screen.getByText("ไม่มีข้อมูลในรอบนี้")).toBeVisible();
});
