import { expect, it } from "vitest";
import archiveJson from "../src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev02.json";
import type { NakhonRatchasimaDroughtForecastArchive } from "../src/types";
import {
  forecastArchiveHorizonValues, forecastArchiveSummaryForSelection, forecastArchiveRiskLabel,
  forecastArchiveRecordForSubdistrict, forecastArchiveTrendMonthsForSelection,
} from "../src/components/nakhon-ratchasima/forecastModel";

const archive = archiveJson as unknown as NakhonRatchasimaDroughtForecastArchive;

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
