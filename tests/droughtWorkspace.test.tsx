import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import archiveJson from "../src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev02.json";
import type { NakhonRatchasimaDroughtForecastArchive } from "../src/types";
import { getNakhonRatchasimaResearchPanelSummary } from "../src/domain";
import { forecastArchiveSummaryForSelection } from "../src/components/nakhon-ratchasima/forecastModel";
import { DroughtForecastWorkspaceKpiStrip } from "../src/components/nakhon-ratchasima/DroughtForecastWorkspace";
import { ResearchDroughtSituationPanel } from "../src/components/nakhon-ratchasima/ResearchPanels";
import { DroughtForecastArchiveSummaryMetrics } from "../src/components/nakhon-ratchasima/ForecastControls";

afterEach(cleanup);
const archive = archiveJson as unknown as NakhonRatchasimaDroughtForecastArchive;

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
