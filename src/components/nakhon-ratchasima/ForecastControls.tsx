import { type NakhonRatchasimaDroughtForecastArchiveTargetMonth, type NakhonRatchasimaDroughtForecastArchiveRecord } from "../../types";
import {
  type ForecastArchiveHorizon,
  forecastArchiveHorizonValues,
  forecastArchiveTargetMonthForSelection,
  type DroughtForecastArchiveLevel,
  type DroughtForecastArchiveSummary,
  forecastArchiveRecordLabel,
} from "./forecastModel";
import { formatMonth, formatMonthParts } from "../../i18n";
import { type SummaryMetric, MetricGrid } from "../PageSummary";
import { formatThaiNumber, type LocalRiskCriterion, forecastArchiveRiskCriterionOptions } from "./workspaceModel";
import {
  Database,
  ShieldAlert,
  TrendingUp,
  Info,
  RotateCcw,
  Droplets,
} from "lucide-react";
import { type AppSelectOption, AppSelect } from "../AppSelect";
import { ForecastMonthSelect } from "../ForecastArchiveRequest";
import { forecastHorizonLabel } from "../../forecastPeriod";
import { IrrigationStatusSelect, type ForecastMapIrrigation } from "../IrrigationStatusSelect";

export function DroughtForecastArchiveHorizonSelector({
  targetMonth,
  selectedHorizon,
  onHorizonChange,
}: {
  targetMonth: NakhonRatchasimaDroughtForecastArchiveTargetMonth;
  selectedHorizon: ForecastArchiveHorizon;
  onHorizonChange: (horizon: ForecastArchiveHorizon) => void;
}) {
  return (
    <div className="nr-forecast-archive-horizon-tabs" role="tablist" aria-label="เลือกกรอบพยากรณ์ภัยแล้ง">
      {forecastArchiveHorizonValues.map((horizon) => {
        const forecastMonth = forecastArchiveTargetMonthForSelection(targetMonth, horizon);
        const dateParts = formatMonthParts(forecastMonth, "th");
        const isSelected = selectedHorizon === horizon;
        return (
          <button
            key={horizon}
            type="button"
            role="tab"
            aria-label={`${forecastHorizonLabel(horizon)} · ${formatMonth(forecastMonth, "th")}`}
            aria-selected={isSelected}
            tabIndex={isSelected ? 0 : -1}
            className={isSelected ? "active" : ""}
            onClick={() => onHorizonChange(horizon)}
            onKeyDown={(event) => {
              const index = forecastArchiveHorizonValues.indexOf(horizon);
              const nextIndex = event.key === "ArrowRight" ? (index + 1) % 6
                : event.key === "ArrowLeft" ? (index + 5) % 6
                  : event.key === "Home" ? 0 : event.key === "End" ? 5 : null;
              if (nextIndex === null) return;
              event.preventDefault();
              onHorizonChange(forecastArchiveHorizonValues[nextIndex]);
              event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus();
            }}
          >
            <strong>{forecastHorizonLabel(horizon, "short")}</strong>
            <span>{dateParts.month}{" "}<br className="nr-forecast-horizon-date-break" />{dateParts.year}</span>
          </button>
        );
      })}
    </div>
  );
}

export function DroughtForecastArchiveSummaryMetrics({
  level,
  summary,
  selectedRecord,
  variant = "detail",
}: {
  level: DroughtForecastArchiveLevel;
  summary: DroughtForecastArchiveSummary;
  selectedRecord?: NakhonRatchasimaDroughtForecastArchiveRecord;
  variant?: "detail" | "overview";
}) {
  const metrics: SummaryMetric[] = [
    {
      label: "อยู่ในขอบเขต",
      value: `${formatThaiNumber(summary.inScopeSubdistricts)}/${formatThaiNumber(summary.totalSubdistricts)} ตำบล`,
      detail: "มีผลพยากรณ์ในรอบที่เลือก",
      icon: <Database size={18} />,
      tone: "info",
      provenance: "REAL",
    },
    {
      label: "ไม่มีความเสี่ยง",
      value: `${formatThaiNumber(summary.noRiskSubdistricts)} ตำบล`,
      detail: summary.inScopeSubdistricts > 0 ? "ผลพยากรณ์: ไม่พบสัญญาณเสี่ยง" : "ไม่มีค่าพยากรณ์ให้ประเมิน",
      icon: <ShieldAlert size={18} />,
      tone: summary.inScopeSubdistricts > 0 ? "good" : "muted",
      provenance: summary.inScopeSubdistricts > 0 ? "REAL" : "PENDING_SOURCE",
    },
    {
      label: "เสี่ยงปานกลาง",
      value: `${formatThaiNumber(summary.moderateRiskSubdistricts)} ตำบล`,
      detail: summary.inScopeSubdistricts > 0 ? "ผลพยากรณ์: เสี่ยงปานกลาง" : "ไม่มีค่าพยากรณ์ให้ประเมิน",
      icon: <TrendingUp size={18} />,
      tone: summary.inScopeSubdistricts > 0 ? "watch" : "muted",
      provenance: summary.inScopeSubdistricts > 0 ? "REAL" : "PENDING_SOURCE",
    },
    {
      label: "เสี่ยงสูง",
      value: `${formatThaiNumber(summary.highRiskSubdistricts)} ตำบล`,
      detail: summary.inScopeSubdistricts > 0 ? "ผลพยากรณ์: เสี่ยงสูง" : "ไม่มีค่าพยากรณ์ให้ประเมิน",
      icon: <TrendingUp size={18} />,
      tone: summary.inScopeSubdistricts > 0 ? "danger" : "muted",
      provenance: summary.inScopeSubdistricts > 0 ? "REAL" : "PENDING_SOURCE",
    },
    {
      label: "นอกขอบเขต",
      value: `${formatThaiNumber(summary.outOfScopeSubdistricts)} ตำบล`,
      detail: "ช่องว่างในชุดข้อมูลไม่ใช่ไม่มีความเสี่ยง",
      icon: <Info size={18} />,
      tone: "muted",
      provenance: "REAL",
    },
  ];

  if (summary.missingSubdistricts > 0) {
    metrics.push({
      label: "ไม่มีข้อมูลในรอบนี้",
      value: `${formatThaiNumber(summary.missingSubdistricts)} ตำบล`,
      detail: "ไม่พบรายการข้อมูลของตำบลในรอบที่เลือก",
      icon: <Info size={18} />,
      tone: "muted",
      provenance: "PENDING_SOURCE",
    });
  }

  if (level === "subdistrict") {
    metrics.push({
      label: "ผลพยากรณ์ของตำบล",
      value: selectedRecord
        ? forecastArchiveRecordLabel(selectedRecord)
        : "ไม่มีข้อมูลในรอบนี้",
      detail: selectedRecord ? `${forecastHorizonLabel(selectedRecord.horizon)} · พยากรณ์ ${formatMonth(selectedRecord.targetMonth, "th")} · เดือนตั้งต้น (T) ${formatMonth(selectedRecord.issueMonth, "th")}` : "ไม่แปลงเป็นไม่มีความเสี่ยง",
      icon: <TrendingUp size={18} />,
      tone: selectedRecord
        ? selectedRecord.forecastRisk === 2
          ? "danger"
          : selectedRecord.forecastRisk === 1
            ? "watch"
            : selectedRecord.forecastRisk === 0
              ? "good"
              : "muted"
        : "muted",
      provenance: selectedRecord ? "REAL" : "PENDING_SOURCE",
    });
  }

  return (
    <MetricGrid
      className={`nr-forecast-archive-mode-metrics${variant === "overview" ? " is-overview" : ""}`}
      variant="segmented"
      ariaLabel="สรุปค่าคลังพยากรณ์ย้อนหลัง"
      metrics={variant === "overview"
        ? [metrics[3], metrics[2], metrics[1], metrics[4], ...metrics.slice(5)].map((metric) => ({ ...metric, detail: undefined }))
        : metrics}
    />
  );
}

export function DroughtForecastArchiveMapFilters({
  irrigation,
  showMonthFilter = true,
  selectedMonth,
  monthOptions,
  onMonthChange,
  riskCriterion,
  onRiskCriterionChange,
  onReset,
  resetDisabled,
  statusText,
  compactValue,
}: {
  irrigation?: ForecastMapIrrigation;
  showMonthFilter?: boolean;
  selectedMonth: string;
  monthOptions: AppSelectOption[];
  onMonthChange: (month: string) => void;
  riskCriterion: LocalRiskCriterion;
  onRiskCriterionChange: (risk: LocalRiskCriterion) => void;
  onReset: () => void;
  resetDisabled: boolean;
  statusText: string | null;
  compactValue: boolean;
}) {
  return (
    <div className={`nr-local-map-criteria is-forecast-archive-controls${irrigation ? " has-irrigation-filter" : ""}${showMonthFilter ? "" : " has-single-filter"}`} aria-label="ตัวกรองแผนที่พยากรณ์ภัยแล้ง">
      {irrigation && <div className="nr-map-color-modes" role="group" aria-label="การแสดงสีแผนที่">
        <button type="button" aria-pressed={irrigation.colorMode === "forecast"} onClick={() => irrigation.onColorModeChange("forecast")}><ShieldAlert size={16} />ความเสี่ยงภัยแล้ง</button>
        <button type="button" aria-pressed={irrigation.colorMode === "irrigation"} onClick={() => irrigation.onColorModeChange("irrigation")}><Droplets size={16} />ชลประทาน</button>
      </div>}
      <div className="nr-map-filter-fields">
      {showMonthFilter && <ForecastMonthSelect
        className="nr-local-map-select"
        ariaLabel="เดือนตั้งต้นบนแผนที่พยากรณ์ภัยแล้ง"
        value={selectedMonth}
        onChange={onMonthChange}
        options={monthOptions}
        compactValue={compactValue}
      />}
      <AppSelect
        className="nr-local-map-select"
        ariaLabel="สถานะพยากรณ์ภัยแล้ง"
        value={riskCriterion}
        onChange={(risk) => onRiskCriterionChange(risk as LocalRiskCriterion)}
        options={forecastArchiveRiskCriterionOptions}
        compactValue={compactValue}
      />
      {irrigation && <IrrigationStatusSelect {...irrigation} compact />}
      <button
        type="button"
        className="nr-local-map-reset"
        onClick={onReset}
        disabled={resetDisabled}
        title="ล้างตัวกรองความเสี่ยงภัยแล้ง"
        aria-label="รีเซ็ต"
      >
        <RotateCcw size={14} />
        <span>รีเซ็ต</span>
      </button>
      </div>
      {statusText && (
        <span className="nr-local-map-filter-status" role="status" aria-live="polite">
          {statusText}
        </span>
      )}
    </div>
  );
}
