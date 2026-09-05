import {
  type NakhonRatchasimaDroughtForecastArchive,
  type NakhonRatchasimaDroughtForecastArchiveTargetMonth,
  type NakhonRatchasimaDroughtForecastArchiveRisk,
  type NakhonRatchasimaDroughtForecastArchiveRecord,
  type NakhonRatchasimaDroughtForecastArchiveLocation,
} from "../../types";
import { useState, useMemo } from "react";
import { type AppSelectOption } from "../AppSelect";
import { type LocalMapStatus, type LocalRiskCriterion } from "./workspaceModel";
import { type NakhonRatchasimaRouteTarget } from "../../domain";

export type DroughtForecastBand = "normal" | "watch" | "severe";

export const DROUGHT_FORECAST_BAND_RANK: Record<DroughtForecastBand, number> = {
  normal: 0,
  watch: 1,
  severe: 2,
};

export type DroughtForecastTrendMonth = {
  monthIndex: number;
  period: string;
  labelTh: string;
  riskSubdistricts: number;
  normalSubdistricts: number;
  totalSubdistricts: number;
  riskPercent: number;
};

export function droughtForecastBand(month: DroughtForecastTrendMonth): DroughtForecastBand {
  if (month.riskPercent >= 0.5) return "severe";
  if (month.riskSubdistricts > 0) return "watch";
  return "normal";
}

export function highestDroughtForecastBand(first: DroughtForecastBand, second: DroughtForecastBand) {
  return DROUGHT_FORECAST_BAND_RANK[first] >= DROUGHT_FORECAST_BAND_RANK[second] ? first : second;
}

export function droughtForecastBandLabel(band: DroughtForecastBand, scope: "area" | "single" = "area") {
  if (scope === "single") {
    const labels: Record<DroughtForecastBand, string> = {
      normal: "ไม่เสี่ยง",
      watch: "เสี่ยงแล้ง",
      severe: "เสี่ยงแล้ง",
    };
    return labels[band];
  }
  const labels: Record<DroughtForecastBand, string> = {
    normal: "ไม่พบพื้นที่เสี่ยง",
    watch: "มีพื้นที่เสี่ยง",
    severe: "เกินครึ่งพื้นที่",
  };
  return labels[band];
}

export function droughtForecastHasRiskSignal(months: DroughtForecastTrendMonth[]) {
  return months.some((month) => month.riskSubdistricts > 0);
}

export function formatDroughtForecastMonthRange(months: DroughtForecastTrendMonth[]) {
  if (months.length === 0) return "";
  if (months.length === 1) return months[0]!.labelTh;
  const ordered = [...months].sort((a, b) => a.monthIndex - b.monthIndex);
  const isContiguous = ordered.every((month, index) => index === 0 || month.monthIndex === ordered[index - 1]!.monthIndex + 1);
  if (isContiguous) return `${ordered[0]!.labelTh} – ${ordered[ordered.length - 1]!.labelTh}`;
  return ordered.map((month) => month.labelTh).join(", ");
}

export function droughtForecastPeakSummary(months: DroughtForecastTrendMonth[]) {
  const peakRiskSubdistricts = Math.max(...months.map((month) => month.riskSubdistricts));
  const peakMonths = months.filter((month) => month.riskSubdistricts === peakRiskSubdistricts);
  return {
    riskSubdistricts: peakRiskSubdistricts,
    monthLabel: formatDroughtForecastMonthRange(peakMonths),
    riskPercent: Math.max(...peakMonths.map((month) => month.riskPercent)),
  };
}

export type ForecastArchiveHorizon = 1 | 2 | 3 | 4 | 5 | 6;

export const forecastArchiveHorizonValues: ForecastArchiveHorizon[] = [1, 2, 3, 4, 5, 6];

export function normalizeForecastArchiveHorizon(value: string | number | null | undefined): ForecastArchiveHorizon {
  const numeric = typeof value === "number" ? value : Number.parseInt(value ?? "", 10);
  return forecastArchiveHorizonValues.includes(numeric as ForecastArchiveHorizon)
    ? (numeric as ForecastArchiveHorizon)
    : 1;
}

export function shiftMonthPeriod(period: string, monthOffset: number) {
  const [year, monthIndex] = period.split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) return null;
  const date = new Date(Date.UTC(year, monthIndex - 1 + monthOffset, 1));
  const shiftedMonth = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  return `${date.getUTCFullYear()}-${shiftedMonth}`;
}

export function forecastArchiveDefaultTargetMonth(archive: NakhonRatchasimaDroughtForecastArchive) {
  return (
    archive.targetMonths.find((month) => month.period === archive.meta.targetMonthEnd) ??
    archive.targetMonths.at(-1) ??
    null
  );
}

export function readForecastArchiveInitialSelection(archive: NakhonRatchasimaDroughtForecastArchive) {
  if (typeof window === "undefined") {
    const defaultMonth = forecastArchiveDefaultTargetMonth(archive);
    return { selectedHorizon: 1 as ForecastArchiveHorizon, selectedTargetPeriod: defaultMonth?.period ?? "" };
  }
  const params = new URLSearchParams(window.location.search);
  const selectedHorizon = normalizeForecastArchiveHorizon(params.get("horizon"));
  const targetMonth = archive.targetMonths.find((month) => month.period === params.get("target"));
  const fallbackTargetMonth = forecastArchiveDefaultTargetMonth(archive);
  return {
    selectedHorizon,
    selectedTargetPeriod: targetMonth?.period ?? fallbackTargetMonth?.period ?? "",
  };
}

export function writeForecastArchiveLocation(month: NakhonRatchasimaDroughtForecastArchiveTargetMonth, horizon: ForecastArchiveHorizon) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("mapLayer", "forecast-archive");
  url.searchParams.set("target", month.period);
  url.searchParams.set("horizon", String(horizon));
  window.history.replaceState(null, "", `${url.pathname}?${url.searchParams.toString()}${url.hash}`);
}

export function pathWithForecastSelection(path: string, period: string, horizon: ForecastArchiveHorizon) {
  const url = new URL(path, "https://workspace.invalid");
  url.searchParams.set("mapLayer", "forecast-archive");
  url.searchParams.set("target", period);
  url.searchParams.set("horizon", String(horizon));
  return `${url.pathname}?${url.searchParams.toString()}${url.hash}`;
}

export function forecastArchiveIssueMonthForSelection(
  month: NakhonRatchasimaDroughtForecastArchiveTargetMonth,
  horizon: ForecastArchiveHorizon,
) {
  return (
    month.horizons.find((item) => item.horizon === horizon)?.issueMonth ??
    shiftMonthPeriod(month.period, -horizon) ??
    month.period
  );
}

export function useDroughtForecastArchiveSelection(archive: NakhonRatchasimaDroughtForecastArchive, fixedHorizon?: ForecastArchiveHorizon) {
  const [selection, setSelection] = useState(() => {
    const initial = readForecastArchiveInitialSelection(archive);
    return { ...initial, selectedHorizon: fixedHorizon ?? initial.selectedHorizon };
  });
  const selectedHorizon = selection.selectedHorizon;
  const selectedMonth =
    archive.targetMonths.find((month) => month.period === selection.selectedTargetPeriod) ??
    forecastArchiveDefaultTargetMonth(archive);
  const selectedIssueMonth = selectedMonth ? forecastArchiveIssueMonthForSelection(selectedMonth, selectedHorizon) : archive.meta.issueMonthEnd;
  const targetMonthOptions = useMemo<AppSelectOption[]>(
    () =>
      [...archive.targetMonths].reverse().map((month) => ({
        value: month.period,
        label: `เป้าหมาย · ${month.labelTh}`,
        triggerLabel: `เป้าหมาย · ${month.labelTh}`,
        group: "เดือนเป้าหมาย",
        description: fixedHorizon ? `เดือนเป้าหมาย · T+${fixedHorizon}` : "เดือนนี้คือเดือนเป้าหมายของแผนที่ · ครบ T+1–T+6",
      })),
    [archive, fixedHorizon],
  );

  const changeHorizon = (horizon: ForecastArchiveHorizon) => {
    if (fixedHorizon !== undefined) return;
    const month = selectedMonth ?? forecastArchiveDefaultTargetMonth(archive);
    setSelection((current) => ({ ...current, selectedHorizon: horizon, selectedTargetPeriod: current.selectedTargetPeriod || month?.period || "" }));
    if (month) writeForecastArchiveLocation(month, horizon);
  };

  const changeTargetMonth = (period: string) => {
    const month = archive.targetMonths.find((item) => item.period === period);
    if (!month) return;
    setSelection((current) => ({ ...current, selectedTargetPeriod: month.period }));
    writeForecastArchiveLocation(month, selectedHorizon);
  };

  return {
    selectedHorizon,
    selectedMonth,
    selectedIssueMonth,
    targetMonthOptions,
    changeHorizon,
    changeTargetMonth,
  };
}

export function forecastArchiveLocationBySubdistrict(archive: NakhonRatchasimaDroughtForecastArchive) {
  return new globalThis.Map(archive.locations.map((location) => [location.subdistrictCode, location]));
}

export function forecastArchiveRiskLabel(risk: NakhonRatchasimaDroughtForecastArchiveRisk | undefined) {
  if (risk === 0) return "ไม่มีความเสี่ยง";
  if (risk === 1) return "เสี่ยงปานกลาง";
  if (risk === 2) return "เสี่ยงสูง";
  if (risk === null) return "นอกขอบเขตการศึกษา";
  return "ไม่มีข้อมูลในรอบนี้";
}

export function localMapStatusForForecastRecord(record: NakhonRatchasimaDroughtForecastArchiveRecord | undefined): LocalMapStatus {
  if (!record) return "forecast-missing";
  if (record.forecastRisk === 0) return "forecast-no-risk";
  if (record.forecastRisk === 1) return "forecast-moderate";
  if (record.forecastRisk === 2) return "forecast-high";
  return "forecast-out-of-scope";
}

export function forecastArchiveRecordForSubdistrict({
  archive,
  month,
  horizon,
  subdistrictCode,
  locationsBySubdistrict,
}: {
  archive: NakhonRatchasimaDroughtForecastArchive;
  month: NakhonRatchasimaDroughtForecastArchiveTargetMonth | null | undefined;
  horizon: ForecastArchiveHorizon;
  subdistrictCode: string;
  locationsBySubdistrict?: Map<string, NakhonRatchasimaDroughtForecastArchiveLocation>;
}): NakhonRatchasimaDroughtForecastArchiveRecord | undefined {
  if (!month) return undefined;
  const risks = archive.packedRiskByTargetMonth[month.period]?.[subdistrictCode];
  if (!risks) return undefined;
  const forecastRisk = risks[horizon - 1] as NakhonRatchasimaDroughtForecastArchiveRisk | undefined;
  if (forecastRisk === undefined) return undefined;
  const location =
    locationsBySubdistrict?.get(subdistrictCode) ??
    archive.locations.find((item) => item.subdistrictCode === subdistrictCode);
  if (!location) return undefined;
  const issueMonth = forecastArchiveIssueMonthForSelection(month, horizon);
  return {
    sourceId: location.sourceId,
    subdistrictCode,
    subdistrictNameTh: location.subdistrictNameTh,
    districtCode: location.districtCode,
    districtNameTh: location.districtNameTh,
    sourceYearMonth: month.period,
    targetMonth: month.period,
    issueMonth,
    horizon,
    horizonLabel: `T+${horizon}`,
    forecastRisk,
    riskLabelTh: forecastArchiveRiskLabel(forecastRisk),
    scopeStatus: forecastRisk === null ? "out_of_scope" : "in_scope",
    vintageKey: `${subdistrictCode}|${month.period}|T+${horizon}`,
    sourceVintageKey: `${location.sourceId}|${month.period}|T+${horizon}`,
  };
}

export function forecastArchiveRecordsForSelection(
  archive: NakhonRatchasimaDroughtForecastArchive,
  month: NakhonRatchasimaDroughtForecastArchiveTargetMonth | null | undefined,
  horizon: ForecastArchiveHorizon,
  expectedSubdistrictCodes?: string[],
) {
  const recordsBySubdistrict = new globalThis.Map<string, NakhonRatchasimaDroughtForecastArchiveRecord>();
  if (!month) return recordsBySubdistrict;
  const locationsBySubdistrict = forecastArchiveLocationBySubdistrict(archive);
  const codes = expectedSubdistrictCodes ?? archive.locations.map((location) => location.subdistrictCode);
  codes.forEach((subdistrictCode) => {
    const record = forecastArchiveRecordForSubdistrict({
      archive,
      month,
      horizon,
      subdistrictCode,
      locationsBySubdistrict,
    });
    if (record) recordsBySubdistrict.set(subdistrictCode, record);
  });
  return recordsBySubdistrict;
}

export function forecastArchiveSummaryForSelection(
  archive: NakhonRatchasimaDroughtForecastArchive,
  month: NakhonRatchasimaDroughtForecastArchiveTargetMonth,
  horizon: ForecastArchiveHorizon,
  expectedSubdistrictCodes?: string[],
) {
  const totalSubdistricts = expectedSubdistrictCodes?.length ?? archive.meta.totalCanonicalSubdistricts;
  const recordsBySubdistrict = forecastArchiveRecordsForSelection(archive, month, horizon, expectedSubdistrictCodes);
  const records = Array.from(recordsBySubdistrict.values());
  const noRiskSubdistricts = records.filter((record) => record.forecastRisk === 0).length;
  const moderateRiskSubdistricts = records.filter((record) => record.forecastRisk === 1).length;
  const highRiskSubdistricts = records.filter((record) => record.forecastRisk === 2).length;
  const outOfScopeSubdistricts = records.filter((record) => record.forecastRisk === null).length;
  const inScopeSubdistricts = noRiskSubdistricts + moderateRiskSubdistricts + highRiskSubdistricts;

  return {
    issueMonth: forecastArchiveIssueMonthForSelection(month, horizon),
    inScopeSubdistricts,
    matchedSubdistricts: recordsBySubdistrict.size,
    missingSubdistricts: Math.max(0, totalSubdistricts - recordsBySubdistrict.size),
    noRiskSubdistricts,
    moderateRiskSubdistricts,
    highRiskSubdistricts,
    outOfScopeSubdistricts,
    recordsBySubdistrict,
    riskSubdistricts: moderateRiskSubdistricts + highRiskSubdistricts,
    totalSubdistricts,
  };
}

export function forecastArchiveTrendMonthsForSelection(
  archive: NakhonRatchasimaDroughtForecastArchive,
  month: NakhonRatchasimaDroughtForecastArchiveTargetMonth,
  expectedSubdistrictCodes?: string[],
): DroughtForecastTrendMonth[] {
  return forecastArchiveHorizonValues.map((horizon) => {
    const summary = forecastArchiveSummaryForSelection(archive, month, horizon, expectedSubdistrictCodes);
    const totalSubdistricts = summary.totalSubdistricts;
    return {
      monthIndex: horizon,
      period: `${month.period}-t-plus-${horizon}`,
      labelTh: `T+${horizon}`,
      riskSubdistricts: summary.riskSubdistricts,
      normalSubdistricts: summary.noRiskSubdistricts,
      totalSubdistricts,
      riskPercent: totalSubdistricts > 0 ? summary.riskSubdistricts / totalSubdistricts : 0,
    };
  });
}

export function forecastArchiveRecordMatchesCriteria(record: NakhonRatchasimaDroughtForecastArchiveRecord | undefined, risk: LocalRiskCriterion) {
  if (risk === "all") return true;
  return localMapStatusForForecastRecord(record) === risk;
}

export function forecastArchiveRecordLabel(record: NakhonRatchasimaDroughtForecastArchiveRecord | undefined) {
  if (!record) return "ไม่มีข้อมูลในรอบนี้";
  return record.riskLabelTh;
}

export function forecastArchiveRecordValueLabel(record: NakhonRatchasimaDroughtForecastArchiveRecord | undefined) {
  if (!record) return "ไม่มีข้อมูล";
  return record.forecastRisk === null ? "นอกขอบเขต" : String(record.forecastRisk);
}

export type DroughtForecastArchiveLevel = "province" | "district" | "subdistrict";

export type DroughtForecastArchiveSummary = ReturnType<typeof forecastArchiveSummaryForSelection>;

export type DroughtForecastWorkspaceTarget = Extract<NakhonRatchasimaRouteTarget, { valid: true }>;
