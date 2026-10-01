import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import archiveJson from "../src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json";
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

it.each(['/', '/?mapLayer=forecast-archive&target=2025-12&horizon=1', '/?period=2026-08'])("keeps the latest Home forecast clean for %s", (path) => {
  window.history.replaceState({ existing: 'preserved' }, '', path);
  const { result } = renderHook(() => useDroughtForecastArchiveSelection(archive, 1));
  expect(window.location.pathname + window.location.search).toBe('/');
  expect(result.current.selectedMonth?.period).toBe('2025-12');
  expect(result.current.selectedHorizon).toBe(1);
  expect(window.history.state).toMatchObject({ existing: 'preserved', ktpHomeForecastOrigin: '2025-12' });
});

it('retains historical Home links and cleans only forecast defaults when returning to the latest month', () => {
  window.history.replaceState({}, '', '/?target=2025-11&horizon=1&district=3008&mapRisk=forecast-high#map');
  const { result } = renderHook(() => useDroughtForecastArchiveSelection(archive, 1));
  expect(result.current.selectedMonth?.period).toBe('2025-11');
  expect(new URLSearchParams(window.location.search).get('target')).toBe('2025-11');
  act(() => result.current.changeTargetMonth('2025-12'));
  expect(window.location.search + window.location.hash).toBe('?district=3008&mapRisk=forecast-high#map');
  act(() => result.current.changeTargetMonth('2025-10'));
  expect(new URLSearchParams(window.location.search).get('target')).toBe('2025-10');
  expect(window.history.state.ktpHomeForecastOrigin).toBeNull();
});

it('derives the clean Home default from the archive rather than a hardcoded month', () => {
  const earlier = { ...archive, meta: { ...archive.meta, targetMonthEnd: '2025-11' } };
  const { result } = renderHook(() => useDroughtForecastArchiveSelection(earlier, 1));
  expect(result.current.selectedMonth?.period).toBe('2025-11');
  expect(window.location.search).toBe('');
  expect(window.history.state.ktpHomeForecastOrigin).toBe('2025-11');
});

it.each([undefined, 1] as const)("shows source month/year in shared origin options with fixed horizon %s", (fixedHorizon) => {
  window.history.replaceState({}, "", "/drought?target=2025-12&horizon=4");
  const { result } = renderHook(() => useDroughtForecastArchiveSelection(archive, fixedHorizon));
  expect(result.current.targetMonthOptions).toEqual([...archive.targetMonths].reverse().map((month) => ({
    value: month.period,
    label: month.labelTh,
    group: "เดือนตั้งต้น",
  })));

  act(() => result.current.changeTargetMonth("2025-11"));
  expect(result.current.selectedMonth?.period).toBe("2025-11");
  expect(result.current.selectedIssueMonth).toBe("2025-11");
  expect(result.current.selectedHorizon).toBe(fixedHorizon ?? 4);
  expect(new URLSearchParams(window.location.search).get("target")).toBe("2025-11");
  expect(new URLSearchParams(window.location.search).get("horizon")).toBe(String(fixedHorizon ?? 4));
});

it("carries a forecast selection through area routes without losing other query or hash state", () => {
  expect(pathWithForecastSelection("/dan-khun-thot/t-300806?view=area#history", "2025-09", 4))
    .toBe("/dan-khun-thot/t-300806?view=area&mapLayer=forecast-archive&target=2025-09&horizon=4#history");
});

it("projects every source month forward without changing any canonical risk or row identity", () => {
  expect(archive.targetMonths).toHaveLength(127);
  expect(archive.targetMonths[0].period).toBe("2015-06");
  expect(archive.targetMonths.at(-1)?.period).toBe("2025-12");
  let checkedRecords = 0;
  const mismatches: string[] = [];
  for (const month of archive.targetMonths) for (const horizon of forecastArchiveHorizonValues) {
    const values = archive.locations.map((location) => archive.packedRiskByTargetMonth[month.period]?.[location.subdistrictCode]?.[horizon - 1]);
    const summary = forecastArchiveSummaryForSelection(archive, month, horizon);
    expect(summary.noRiskSubdistricts).toBe(values.filter((value) => value === 0).length);
    expect(summary.moderateRiskSubdistricts).toBe(values.filter((value) => value === 1).length);
    expect(summary.highRiskSubdistricts).toBe(values.filter((value) => value === 2).length);
    expect(summary.outOfScopeSubdistricts).toBe(values.filter((value) => value === null).length);
    expect(summary.missingSubdistricts).toBe(values.filter((value) => value === undefined).length);
    expect(summary.totalSubdistricts).toBe(289);
    const [year, monthNumber] = month.period.split("-").map(Number);
    const targetIndex = year * 12 + monthNumber - 1 + horizon;
    const expectedTarget = `${Math.floor(targetIndex / 12)}-${String(targetIndex % 12 + 1).padStart(2, "0")}`;
    expect(summary.issueMonth).toBe(month.period);
    expect(summary.targetMonth).toBe(expectedTarget);
    for (const location of archive.locations) {
      const record = summary.recordsBySubdistrict.get(location.subdistrictCode);
      const rawRisk = archive.packedRiskByTargetMonth[month.period][location.subdistrictCode][horizon - 1];
      if (!record || record.sourceYearMonth !== month.period || record.issueMonth !== month.period
        || record.targetMonth !== expectedTarget || record.forecastRisk !== rawRisk
        || record.vintageKey !== `${location.subdistrictCode}|${month.period}|T+${horizon}`) {
        mismatches.push(`${location.subdistrictCode}|${month.period}|T+${horizon}`);
      }
      checkedRecords += 1;
    }
  }
  expect(mismatches).toEqual([]);
  expect(checkedRecords).toBe(220218);
}, 30_000);

it.each([
  ["2015-06", ["2015-07", "2015-08", "2015-09", "2015-10", "2015-11", "2015-12"]],
  ["2025-12", ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"]],
] as const)("plots the six future months from origin %s", (origin, targets) => {
  const month = archive.targetMonths.find((item) => item.period === origin)!;
  expect(forecastArchiveTrendMonthsForSelection(archive, month).map((point) => point.period)).toEqual(targets);
});

it("keeps origin T fixed when changing horizon and when restoring a saved URL", () => {
  window.history.replaceState({}, "", "/drought?target=2025-12&horizon=4");
  const { result } = renderHook(() => useDroughtForecastArchiveSelection(archive));
  expect(result.current.selectedIssueMonth).toBe("2025-12");
  act(() => result.current.changeHorizon(6));
  expect(result.current.selectedMonth?.period).toBe("2025-12");
  expect(result.current.selectedIssueMonth).toBe("2025-12");
  expect(new URLSearchParams(window.location.search).get("target")).toBe("2025-12");
  expect(new URLSearchParams(window.location.search).get("horizon")).toBe("6");
});

it("keeps null, zero and missing distinct and retains source/T vintage identity", () => {
  expect(new Set([0, 1, 2, null, undefined].map((risk) => forecastArchiveRiskLabel(risk as 0 | 1 | 2 | null | undefined))).size).toBe(5);
  const month = archive.targetMonths.find((month) => month.period === "2025-12")!;
  const record = forecastArchiveRecordForSubdistrict({ archive, month, horizon: 4, subdistrictCode: "300806" });
  expect(record).toMatchObject({ forecastRisk: 2, vintageKey: "300806|2025-12|T+4", sourceYearMonth: "2025-12", issueMonth: "2025-12", targetMonth: "2026-04" });
  const summary = forecastArchiveSummaryForSelection(archive, month, 4, ["300806", "missing"]);
  expect(summary).toMatchObject({ totalSubdistricts: 2, highRiskSubdistricts: 1, missingSubdistricts: 1 });
  expect(forecastArchiveTrendMonthsForSelection(archive, month, ["300806"])).toHaveLength(6);
});
