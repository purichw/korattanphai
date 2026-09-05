import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import archiveJson from "../src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev02.json";
import type { NakhonRatchasimaDroughtForecastArchive } from "../src/types";
import {
  forecastArchiveHorizonValues, forecastArchiveSummaryForSelection, forecastArchiveRiskLabel,
  forecastArchiveRecordForSubdistrict, forecastArchiveTrendMonthsForSelection,
  pathWithForecastSelection, useDroughtForecastArchiveSelection,
} from "../src/components/nakhon-ratchasima/forecastModel";

const archive = archiveJson as unknown as NakhonRatchasimaDroughtForecastArchive;

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
});

it.each([undefined, 1] as const)("shows only month/year in shared target options with fixed horizon %s", (fixedHorizon) => {
  window.history.replaceState({}, "", "/drought?target=2025-12&horizon=4");
  const { result } = renderHook(() => useDroughtForecastArchiveSelection(archive, fixedHorizon));
  expect(result.current.targetMonthOptions).toEqual([...archive.targetMonths].reverse().map((month) => ({
    value: month.period,
    label: month.labelTh,
    group: "เดือนเป้าหมาย",
  })));

  act(() => result.current.changeTargetMonth("2025-11"));
  expect(result.current.selectedMonth?.period).toBe("2025-11");
  expect(result.current.selectedHorizon).toBe(fixedHorizon ?? 4);
  expect(new URLSearchParams(window.location.search).get("target")).toBe("2025-11");
  expect(new URLSearchParams(window.location.search).get("horizon")).toBe(String(fixedHorizon ?? 4));
});

it("carries a forecast selection through area routes without losing other query or hash state", () => {
  expect(pathWithForecastSelection("/dan-khun-thot/t-300806?view=area#history", "2025-09", 4))
    .toBe("/dan-khun-thot/t-300806?view=area&mapLayer=forecast-archive&target=2025-09&horizon=4#history");
});

it("preserves every canonical target/horizon count after extracting the forecast model", () => {
  for (const month of archive.targetMonths) for (const horizon of forecastArchiveHorizonValues) {
    const values = archive.locations.map((location) => archive.packedRiskByTargetMonth[month.period]?.[location.subdistrictCode]?.[horizon - 1]);
    const summary = forecastArchiveSummaryForSelection(archive, month, horizon);
    expect(summary.noRiskSubdistricts).toBe(values.filter((value) => value === 0).length);
    expect(summary.moderateRiskSubdistricts).toBe(values.filter((value) => value === 1).length);
    expect(summary.highRiskSubdistricts).toBe(values.filter((value) => value === 2).length);
    expect(summary.outOfScopeSubdistricts).toBe(values.filter((value) => value === null).length);
    expect(summary.missingSubdistricts).toBe(values.filter((value) => value === undefined).length);
    expect(summary.totalSubdistricts).toBe(289);
  }
}, 30_000);

it("keeps null, zero and missing distinct and retains target/T vintage identity", () => {
  expect(new Set([0, 1, 2, null, undefined].map((risk) => forecastArchiveRiskLabel(risk as 0 | 1 | 2 | null | undefined))).size).toBe(5);
  const month = archive.targetMonths.find((month) => month.period === "2025-12")!;
  const record = forecastArchiveRecordForSubdistrict({ archive, month, horizon: 4, subdistrictCode: "300806" });
  expect(record).toMatchObject({ forecastRisk: 2, vintageKey: "300806|2025-12|T+4", issueMonth: "2025-08" });
  const summary = forecastArchiveSummaryForSelection(archive, month, 4, ["300806", "missing"]);
  expect(summary).toMatchObject({ totalSubdistricts: 2, highRiskSubdistricts: 1, missingSubdistricts: 1 });
  expect(forecastArchiveTrendMonthsForSelection(archive, month, ["300806"])).toHaveLength(6);
});
