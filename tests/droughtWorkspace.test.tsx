import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import archiveJson from "../src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json";
import type { NakhonRatchasimaDroughtForecastArchive } from "../src/types";
import { getNakhonRatchasimaDistrictByCode } from "../src/domain";
import { forecastRiskShare, forecastArchiveSummaryForSelection, forecastArchiveTrendMonthsForSelection } from "../src/components/nakhon-ratchasima/forecastModel";
import { DroughtForecastTrendGraph, DroughtForecastWorkspaceKpiStrip, DroughtForecastWorkspaceChart } from "../src/components/nakhon-ratchasima/DroughtForecastWorkspace";
import { DroughtForecastArchiveSummaryMetrics } from "../src/components/nakhon-ratchasima/ForecastControls";
import { DroughtOperationalDisclosure, DroughtOperationalDisclosureGroup, DroughtOperationalSummary } from "../src/components/nakhon-ratchasima/DroughtOperationalWorkspace";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const archive = archiveJson as unknown as NakhonRatchasimaDroughtForecastArchive;

it.each([
  [142, 142, "", "100%"],
  [0, 4, "", "0%"],
  [0, 0, "has-no-data", "ไม่มีค่าพยากรณ์ในรอบนี้"],
] as const)("shares the operational disclosure without changing risk/availability (%i/%i)", (risk, inScope, state, value) => {
  const summary = { ...forecastArchiveSummaryForSelection(archive, archive.targetMonths[0], 4),
    riskSubdistricts: risk, inScopeSubdistricts: inScope, riskPercent: forecastRiskShare(risk, inScope) };
  const { container } = render(<DroughtOperationalSummary horizon={4} summary={summary} />);
  expect(container.firstChild).toHaveClass("nr-operational-disclosure", "nr-operational-forecast-summary");
  expect(container.querySelector("summary")).toHaveClass("nr-operational-card-heading");
  expect(container.firstChild).not.toHaveAttribute("open");
  if (state) expect(container.firstChild).toHaveClass(state);
  expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("ตำบลที่พบความเสี่ยง (ล่วงหน้า 4 เดือน)");
  expect(screen.getByText(value)).toHaveClass("metric-card-value");
  expect(screen.getByText(`มีค่าพยากรณ์ ${inScope}/289 ตำบลทั้งหมด`).parentElement).toHaveClass("metric-card-detail");
  expect(container.firstChild).not.toHaveClass("has-risk", "is-danger");
  expect(screen.queryByRole("button")).toBeNull();
});

it("opens only one action, moves it after the collapsed cards and preserves focus and content", () => {
  const summary = forecastArchiveSummaryForSelection(archive, archive.targetMonths[0], 4);
  const { container } = render(<DroughtOperationalDisclosureGroup>
    <DroughtOperationalSummary key="risk" horizon={4} summary={summary} />
    <DroughtOperationalDisclosure key="attention" title="ตรวจสอบ"><input aria-label="บันทึกทดสอบ" defaultValue="" /></DroughtOperationalDisclosure>
    <DroughtOperationalDisclosure key="guidance" title="คำแนะนำ"><p>ข้อควรระวัง</p></DroughtOperationalDisclosure>
  </DroughtOperationalDisclosureGroup>);
  const group = container.firstElementChild!;
  const initialCards = [...group.children];
  const input = container.querySelector("input")!;
  fireEvent.change(input, { target: { value: "คงข้อความเดิม" } });
  for (const card of [initialCards[1], initialCards[0], initialCards[2], initialCards[1]]) {
    const trigger = card.querySelector("summary")!;
    trigger.focus();
    fireEvent.click(trigger);
    expect(group.querySelectorAll("details[open]")).toHaveLength(1);
    expect(group.lastElementChild).toBe(card);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveFocus();
    expect(input).toHaveValue("คงข้อความเดิม");
  }
  fireEvent.click(initialCards[1].querySelector("summary")!);
  expect(group.querySelectorAll("details[open]")).toHaveLength(0);
  expect([...group.children]).toEqual(initialCards);
});

it("clears a removed action without opening it again when the filtered data returns", () => {
  const actions = (showAttention: boolean) => <DroughtOperationalDisclosureGroup>
    {showAttention && <DroughtOperationalDisclosure key="attention" title="ตรวจสอบ"><p>รายชื่อตำบล</p></DroughtOperationalDisclosure>}
    <DroughtOperationalDisclosure key="guidance" title="คำแนะนำ"><p>ข้อควรระวัง</p></DroughtOperationalDisclosure>
  </DroughtOperationalDisclosureGroup>;
  const { container, rerender } = render(actions(true));
  fireEvent.click(screen.getByText("ตรวจสอบ"));
  expect(container.querySelectorAll("details[open]")).toHaveLength(1);
  rerender(actions(false));
  expect(container.querySelectorAll("details[open]")).toHaveLength(0);
  rerender(actions(true));
  expect(container.querySelectorAll("details[open]")).toHaveLength(0);
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

it.each(["province", "district"])("keeps original risk levels separate in the %s chart without a severity threshold", (level) => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  const month = archive.targetMonths.find((item) => item.period === "2025-12")!;
  const codes = level === "province" ? undefined : archive.locations.filter((item) => item.districtCode === "3008").map((item) => item.subdistrictCode);
  const months = forecastArchiveTrendMonthsForSelection(archive, month, codes);
  const { container } = render(<DroughtForecastTrendGraph months={months} activeHorizon={1} />);
  expect(screen.getByText("เสี่ยงปานกลาง (1)").closest("figcaption")).not.toBeNull();
  expect(screen.getByText("เสี่ยงสูง (2)").closest("figcaption")).not.toBeNull();
  expect(container.querySelector(".nr-drought-forecast-graph-threshold, .is-severe")).toBeNull();
  const active = container.querySelector(".nr-forecast-point-group.is-active")!;
  expect(active.querySelector(".nr-drought-forecast-bar.is-moderate")).toHaveAttribute("data-count", String(months[0].moderateRiskSubdistricts));
  expect(active.querySelector(".nr-drought-forecast-bar.is-high")).toBeNull();
  expect(active.querySelector(".nr-drought-forecast-point-label")).toHaveTextContent("100%");
});

it.each([false, true])("reserves space below zero-value points for X-axis labels (compact: %s)", (compact) => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: compact, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  const months = forecastArchiveTrendMonthsForSelection(archive, archive.targetMonths[0]);
  const { container } = render(<DroughtForecastTrendGraph months={months} activeHorizon={1} />);
  const zeroGuide = [...container.querySelectorAll(".nr-forecast-graph-guide")].find((guide) => guide.querySelector("text")!.textContent === "0%")!;
  const zeroY = Number(zeroGuide.querySelector("line")!.getAttribute("y1"));
  const labels = container.querySelectorAll(".nr-forecast-axis-date");
  expect(labels).toHaveLength(6);
  for (const [index, label] of [...labels].entries()) {
    const [horizonLabel, monthLabel] = label.querySelectorAll("tspan");
    expect(horizonLabel.textContent).toBe(`${index + 1} เดือน`);
    expect(Number(label.getAttribute("y")) - zeroY).toBeGreaterThanOrEqual(24);
    expect(Number(label.getAttribute("y")) + Number(monthLabel.getAttribute("dy")) - zeroY).toBeGreaterThanOrEqual(40);
    expect(monthLabel.textContent).toContain(months[index].labelTh.slice(0, 4));
  }
});

it("shares accessible monthly details across hover, focus and tap without changing the selected horizon", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  const month = archive.targetMonths.find(item => item.period === "2025-12")!;
  const codes = archive.locations.filter(item => item.districtCode === "3003").map(item => item.subdistrictCode);
  const months = forecastArchiveTrendMonthsForSelection(archive, month, codes);
  const { container, rerender } = render(<DroughtForecastTrendGraph months={months} activeHorizon={1} />);
  const targets = screen.getAllByRole("button", { name: /รายละเอียดล่วงหน้า / });
  expect(targets).toHaveLength(6);
  expect(container.querySelectorAll("figcaption > span")).toHaveLength(4);
  fireEvent.pointerEnter(targets[4], { pointerType: "mouse" });
  expect(screen.getByRole("tooltip")).toHaveTextContent("5 เดือน");
  expect(screen.getByRole("tooltip")).toHaveTextContent(`มีค่าพยากรณ์ ${months[4].inScopeSubdistricts}/6 ตำบล`);
  fireEvent.pointerLeave(container.querySelector("figure")!);
  expect(screen.queryByRole("tooltip")).toBeNull();
  fireEvent.focus(targets[0]);
  expect(targets[0]).toHaveAttribute("aria-describedby", screen.getByRole("tooltip").id);
  fireEvent.keyDown(targets[0], { key: "ArrowRight" });
  expect(targets[1]).toHaveFocus();
  expect(screen.getByRole("tooltip")).toHaveTextContent("2 เดือน");
  fireEvent.keyDown(targets[1], { key: "Escape" });
  expect(screen.queryByRole("tooltip")).toBeNull();
  fireEvent.click(targets[5]);
  expect(screen.getByRole("tooltip")).toHaveTextContent("6 เดือน");
  expect(container.querySelector(".nr-forecast-point-group.is-active")).toHaveTextContent("1 เดือน");
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole("tooltip")).toBeNull();
  fireEvent.click(targets[5]);
  rerender(<DroughtForecastTrendGraph months={months} activeHorizon={1} unit="count" />);
  expect(screen.queryByRole("tooltip")).toBeNull();
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
  expect(stats.querySelector(".is-coverage .metric-card-detail")).toHaveTextContent("33% ของจำนวนตำบลทั้งหมด");
  expect(within(stats).getByText("100% ของตำบลที่มีค่าพยากรณ์")).toBeInTheDocument();
  expect(within(stats).getByRole("heading", { name: "สรุปเดือน ม.ค. 2569" })).toBeInTheDocument();
});

it("preserves coverage at every archive horizon, including all-null scopes", () => {
  for (const month of archive.targetMonths) {
    for (const district of new Set(archive.locations.map((item) => item.districtCode))) {
      const codes = archive.locations.filter((item) => item.districtCode === district).map((item) => item.subdistrictCode);
      for (const point of forecastArchiveTrendMonthsForSelection(archive, month, codes)) {
        expect(point.inScopeSubdistricts + point.outOfScopeSubdistricts + point.missingSubdistricts).toBe(codes.length);
        expect(point.riskPercent === null).toBe(point.inScopeSubdistricts === 0);
        if (point.inScopeSubdistricts > 0) expect(point.riskPercent).toBe(point.riskSubdistricts / point.inScopeSubdistricts);
        expect(point.moderateRiskSubdistricts + point.highRiskSubdistricts).toBe(point.riskSubdistricts);
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
  expect(container.querySelector(".nr-drought-forecast-bar, .nr-drought-forecast-zero")).toBeNull();
});

it("distinguishes no risk from unavailable horizons without drawing invented values", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  const month = archive.targetMonths.find((item) => item.period === "2025-12")!;
  const fixture = { ...archive, packedRiskByTargetMonth: { [month.period]: { "300806": [0, null, 1, 2, 0, 0] } } } as NakhonRatchasimaDroughtForecastArchive;
  const months = forecastArchiveTrendMonthsForSelection(fixture, month, ["300806"]);
  const { container } = render(<DroughtForecastTrendGraph months={months} />);
  expect(container.querySelectorAll(".nr-drought-forecast-bar")).toHaveLength(2);
  expect(container.querySelectorAll(".nr-drought-forecast-zero")).toHaveLength(3);
  const unavailable = container.querySelectorAll(".nr-forecast-point-group")[1];
  expect(unavailable.querySelector("rect, line")).toBeNull();
  expect(screen.getByText("ไม่มีค่า")).toBeInTheDocument();
  expect(container.textContent).not.toContain("ล่วงหน้า 1 เดือน · ล่วงหน้า 1 เดือน");
});

it("uses six in-scope tambons, not all sixteen, without upgrading moderate risk to high", () => {
  const month = archive.targetMonths.find((item) => item.period === "2025-12")!;
  const codes = archive.locations.filter((item) => item.districtSlug === "dan-khun-thot").map((item) => item.subdistrictCode);
  const point = forecastArchiveTrendMonthsForSelection(archive, month, codes)[0];
  expect(point.riskSubdistricts).toBe(6);
  expect(point.totalSubdistricts).toBe(16);
  expect(point.inScopeSubdistricts).toBe(6);
  expect(point.outOfScopeSubdistricts).toBe(10);
  expect(point.riskPercent).toBe(1);
  expect(point.moderateRiskSubdistricts).toBe(6);
  expect(point.highRiskSubdistricts).toBe(0);
});

it("switches percentage/count without changing the scope, selected horizon or category counts", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  const month = archive.targetMonths.find((item) => item.period === "2025-12")!;
  const fixture = { ...archive, packedRiskByTargetMonth: { [month.period]: {
    "300803": [0, 0, 0, 0, 0, 0], "300804": [1, 1, 1, 1, 1, 1], "300806": [2, 2, 2, 2, 2, 2],
    "300801": [null, null, null, null, null, null],
  } } } as NakhonRatchasimaDroughtForecastArchive;
  const months = forecastArchiveTrendMonthsForSelection(fixture, month, ["300803", "300804", "300806", "300801", "missing"]);
  const { container, rerender } = render(<DroughtForecastWorkspaceChart trendMonths={months} selectedHorizon={4} scopeLabel="อำเภอ" coverageRemark="มีค่าพยากรณ์ 3/5 ตำบล" />);
  expect(screen.getByRole("button", { name: "เปอร์เซ็นต์", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(container.querySelector(".is-active .nr-drought-forecast-point-label")).toHaveTextContent("66.7%");
  expect(months[0].riskPercent).toBeCloseTo(2 / 3);
  fireEvent.click(screen.getByRole("button", { name: "จำนวนตำบล", exact: true }));
  expect(container.querySelector(".is-active .nr-drought-forecast-point-label")).toHaveTextContent(/^2$/);
  expect(container.querySelector(".is-active .is-moderate")).toHaveAttribute("data-count", "1");
  expect(container.querySelector(".is-active .is-high")).toHaveAttribute("data-count", "1");
  rerender(<DroughtForecastWorkspaceChart trendMonths={months} selectedHorizon={5} scopeLabel="อำเภอ" coverageRemark="มีค่าพยากรณ์ 3/5 ตำบล" />);
  expect(screen.getByRole("button", { name: "จำนวนตำบล", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(container.querySelector(".is-active")).toHaveTextContent("5 เดือน");
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

it("does not color an unmatched overview forecast as no risk", () => {
  const month = archive.targetMonths.find((item) => item.period === "2025-12")!;
  const summary = forecastArchiveSummaryForSelection(archive, month, 1, ["missing"]);
  render(<DroughtForecastArchiveSummaryMetrics level="province" variant="overview" summary={summary} />);
  expect(screen.getByText("ไม่มีความเสี่ยง").closest(".metric-card")).toHaveClass("is-muted");
  expect(screen.getByText("ไม่มีข้อมูลในรอบนี้")).toBeVisible();
});
