import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import data from "../src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json";
import type { NakhonRatchasimaDroughtForecastArchive } from "../src/types";
import { forecastSubdistrictCodesForIrrigation, irrigationColors, irrigationHistoryState, irrigationStatusFromSource, normalizeIrrigationCriterion, readIrrigationSelection } from "../src/irrigation";
import { forecastArchiveSummaryForSelection, forecastArchiveTrendMonthsForSelection, pathWithForecastSelection, useDroughtForecastArchiveSelection } from "../src/components/nakhon-ratchasima/forecastModel";

const archive = data as NakhonRatchasimaDroughtForecastArchive;
afterEach(() => { cleanup(); window.history.replaceState(null, "", "/"); });

it.each([
  ["Irragation", "irrigated"], ["Irrigation", "irrigated"], ["RainFed", "rainfed"],
  ["Collecting", "unknown"], [undefined, "unknown"], ["other", "unknown"],
])("maps source status %s without inferring risk", (source, expected) => {
  expect(irrigationStatusFromSource(source)).toBe(expected);
});

it("partitions all 289 source locations without loss or overlap", () => {
  const groups = ["irrigated", "rainfed", "unknown"].map((value) => forecastSubdistrictCodesForIrrigation(archive, value as "irrigated"));
  expect(groups.map((codes) => codes.length)).toEqual([20, 97, 172]);
  expect(new Set(groups.flat()).size).toBe(289);
  expect(forecastSubdistrictCodesForIrrigation(archive, "all")).toHaveLength(289);
  expect(normalizeIrrigationCriterion("Collecting")).toBe("all");
});

it("intersects district/subdistrict scope including an empty result", () => {
  const codes = archive.locations.filter((l) => l.districtCode === "3008").map((l) => l.subdistrictCode);
  expect(forecastSubdistrictCodesForIrrigation(archive, "irrigated", codes)).toEqual([]);
  expect(forecastSubdistrictCodesForIrrigation(archive, "rainfed", ["300803"])).toEqual(["300803"]);
  expect(forecastSubdistrictCodesForIrrigation(archive, "unknown", ["300803"])).toEqual([]);
  expect(forecastSubdistrictCodesForIrrigation(archive, "rainfed", ["300806"])).toEqual(["300806"]);
});

it("preserves source risk/null and reconciles all target/horizon totals across irrigation groups", () => {
  const groups = ["irrigated", "rainfed", "unknown"].map((value) => forecastSubdistrictCodesForIrrigation(archive, value as "irrigated"));
  const dimensions = ["noRiskSubdistricts", "moderateRiskSubdistricts", "highRiskSubdistricts", "outOfScopeSubdistricts", "missingSubdistricts", "totalSubdistricts"] as const;
  for (const month of archive.targetMonths) for (const horizon of [1, 2, 3, 4, 5, 6] as const) {
    const overall = forecastArchiveSummaryForSelection(archive, month, horizon);
    const summaries = groups.map((codes) => forecastArchiveSummaryForSelection(archive, month, horizon, codes));
    for (const dimension of dimensions) expect(summaries.reduce((sum, row) => sum + row[dimension], 0)).toBe(overall[dimension]);
  }
  const month = archive.targetMonths.at(-1)!;
  const unknown = forecastArchiveSummaryForSelection(archive, month, 1, groups[2]);
  expect(unknown.riskSubdistricts).toBe(0);
  expect(unknown.outOfScopeSubdistricts).toBe(172);
  expect(forecastArchiveTrendMonthsForSelection(archive, month, groups[0]).every((point) => point.totalSubdistricts === 20)).toBe(true);
  expect(forecastArchiveSummaryForSelection(archive, month, 1, [])).toMatchObject({ totalSubdistricts: 0, inScopeSubdistricts: 0, missingSubdistricts: 0 });
});

it("keeps the exact URL and history entry when changing irrigation, and restores the live state", () => {
  window.history.replaceState({ existing: "preserved" }, "", "/drought?target=2025-12&horizon=4&irrigation=rainfed#map");
  const url = window.location.href;
  const length = window.history.length;
  const { result, unmount } = renderHook(() => useDroughtForecastArchiveSelection(archive));
  act(() => result.current.changeIrrigation("unknown"));
  expect(window.location.href).toBe(url);
  expect(window.history.length).toBe(length);
  expect(window.history.state).toEqual({ existing: "preserved", ktpIrrigation: "unknown" });
  expect(result.current.irrigation.colorMode).toBe("irrigation");
  unmount();
  const restored = renderHook(() => useDroughtForecastArchiveSelection(archive));
  expect(restored.result.current.selectedIrrigation).toBe("unknown");
  act(() => restored.result.current.irrigation.onColorModeChange("forecast"));
  expect(restored.result.current.selectedIrrigation).toBe("unknown");
  expect(window.location.href).toBe(url);
});

it("validates live state, falls back to deep links and distinguishes categorical colors", () => {
  expect(readIrrigationSelection("?irrigation=rainfed", { ktpIrrigation: "all" })).toBe("all");
  expect(readIrrigationSelection("?irrigation=rainfed", { ktpIrrigation: "Collecting" })).toBe("rainfed");
  expect(readIrrigationSelection("?irrigation=unsafe", null)).toBe("all");
  expect(irrigationHistoryState(null, "unknown")).toEqual({ ktpIrrigation: "unknown" });
  expect(new Set(Object.values(irrigationColors)).size).toBe(3);
});

it("preserves irrigation across month/horizon changes and route navigation; reset clears only irrigation state", () => {
  window.history.replaceState(null, "", "/drought?target=2025-12&horizon=4&irrigation=rainfed&mapRisk=forecast-high");
  const { result } = renderHook(() => useDroughtForecastArchiveSelection(archive));
  expect(result.current.selectedIrrigation).toBe("rainfed");
  act(() => result.current.changeHorizon(3));
  act(() => result.current.changeTargetMonth("2025-11"));
  expect(new URLSearchParams(window.location.search).get("irrigation")).toBe("rainfed");
  expect(pathWithForecastSelection("/dan-khun-thot#map", "2025-11", 3, "rainfed")).toBe("/dan-khun-thot?mapLayer=forecast-archive&target=2025-11&horizon=3&irrigation=rainfed#map");
  act(() => result.current.changeIrrigation("all"));
  const params = new URLSearchParams(window.location.search);
  expect(params.get("irrigation")).toBe("rainfed");
  expect(result.current.selectedIrrigation).toBe("all");
  expect(readIrrigationSelection(window.location.search, window.history.state)).toBe("all");
  expect(params.get("mapRisk")).toBe("forecast-high");
  expect(result.current.selectedMonth?.period).toBe("2025-11");
  expect(result.current.selectedHorizon).toBe(3);
});
