import { type NakhonRatchasimaDroughtForecastArchiveTargetMonth, type NakhonRatchasimaDroughtForecastArchiveRecord } from "../../types";
import {
  type ForecastArchiveHorizon,
  forecastArchiveHorizonValues,
  forecastArchiveIssueMonthForSelection,
  type DroughtForecastArchiveLevel,
  type DroughtForecastArchiveSummary,
  forecastArchiveRecordLabel,
} from "./forecastModel";
import { formatMonth } from "../../i18n";
import { type SummaryMetric, MetricGrid } from "../PageSummary";
import { formatThaiNumber, type LocalRiskCriterion, forecastArchiveRiskCriterionOptions } from "./workspaceModel";
import {
  Database,
  ShieldAlert,
  TrendingUp,
  Info,
  RotateCcw,
} from "lucide-react";
import { type AppSelectOption, AppSelect } from "../AppSelect";

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
        const issueMonth = forecastArchiveIssueMonthForSelection(targetMonth, horizon);
        const isSelected = selectedHorizon === horizon;
        return (
          <button
            key={horizon}
            type="button"
            role="tab"
            aria-selected={isSelected}
            className={isSelected ? "active" : ""}
            onClick={() => onHorizonChange(horizon)}
          >
            <strong>T+{horizon}</strong>
            <span>อ้างอิง {formatMonth(issueMonth, "th")}</span>
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
      detail: selectedRecord ? `${selectedRecord.horizonLabel} · อ้างอิง (คำนวณ) ${formatMonth(selectedRecord.issueMonth, "th")}` : "ไม่แปลงเป็นไม่มีความเสี่ยง",
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
    <div className={`nr-local-map-criteria is-forecast-archive-controls${showMonthFilter ? "" : " has-single-filter"}`} aria-label="ตัวกรองแผนที่พยากรณ์ภัยแล้ง">
      {showMonthFilter && <AppSelect
        className="nr-local-map-select"
        ariaLabel="เดือนเป้าหมายบนแผนที่พยากรณ์ภัยแล้ง"
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
      <button
        type="button"
        className="nr-local-map-reset"
        onClick={onReset}
        disabled={resetDisabled}
        title="ล้างเงื่อนไขแผนที่"
        aria-label="รีเซ็ต"
      >
        <RotateCcw size={14} />
        <span>รีเซ็ต</span>
      </button>
      {statusText && (
        <span className="nr-local-map-filter-status" role="status" aria-live="polite">
          {statusText}
        </span>
      )}
    </div>
  );
}
