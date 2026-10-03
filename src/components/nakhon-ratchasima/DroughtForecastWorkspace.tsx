import {
  AlertTriangle,
  CalendarDays,
  ChartColumn,
  Database,
  Info,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  Sprout,
  TrendingUp
} from "lucide-react";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { forecastHorizonLabel } from "../../forecastPeriod";
import { formatMonth } from "../../i18n";
import { forecastSubdistrictCodesForIrrigation } from "../../irrigation";
import {
  type NakhonRatchasimaDroughtForecastArchive,
  type NakhonRatchasimaDroughtForecastArchiveRecord,
  type NakhonRatchasimaDroughtForecastArchiveTargetMonth
} from "../../types";
import { type AppSelectOption } from "../AppSelect";
import { DataProvenanceChip, type DataProvenanceChipKind } from "../DataProvenanceChip";
import { IrrigationEmptyState } from "../IrrigationEmptyState";
import type { ForecastMapIrrigation } from "../IrrigationStatusSelect";
import { MetricCard, MetricGrid, type SummaryMetric } from "../PageSummary";
import { DroughtOperationalDisclosure, DroughtOperationalDisclosureGroup, DroughtOperationalSummary, DroughtWorkspaceFilters, DroughtWorkspaceHeader } from "./DroughtOperationalWorkspace";
import { DroughtForecastArchiveHorizonSelector, DroughtForecastArchiveSummaryMetrics } from "./ForecastControls";
import {
  type DroughtForecastArchiveLevel,
  type DroughtForecastArchiveSummary,
  type DroughtForecastTrendMonth,
  type DroughtForecastWorkspaceTarget,
  type ForecastArchiveHorizon,
  forecastArchiveRecordLabel,
  forecastArchiveSummaryForSelection,
  forecastArchiveTargetMonthForSelection,
  forecastArchiveTrendMonthsForSelection,
  pathWithForecastSelection,
} from "./forecastModel";
import { DroughtForecastTrendGraph } from "./ForecastRiskBarGraph";
import { NakhonRatchasimaLocalMap } from "./NakhonRatchasimaLocalMap";
import { DashboardSection, EmptyLocalEvidence } from "./SharedPanels";
import { formatPercent, formatThaiNumber, pathForSubdistrictCode } from "./workspaceModel";

export { DroughtForecastTrendGraph } from "./ForecastRiskBarGraph";

export function DroughtForecastArchivePanel({
  archive,
  level,
  expectedSubdistrictCodes,
  selectedTargetMonth,
  selectedHorizon,
  onHorizonChange,
  showHorizonSelector = true,
}: {
  archive: NakhonRatchasimaDroughtForecastArchive;
  level: DroughtForecastArchiveLevel;
  expectedSubdistrictCodes?: string[];
  selectedTargetMonth: NakhonRatchasimaDroughtForecastArchiveTargetMonth | null;
  selectedHorizon: ForecastArchiveHorizon;
  onHorizonChange: (horizon: ForecastArchiveHorizon) => void;
  showHorizonSelector?: boolean;
}) {
  const selectedMonth = selectedTargetMonth;
  const isDistrict = level === "district";
  const isSubdistrict = level === "subdistrict";
  const sectionTitle = isSubdistrict
    ? "พยากรณ์ย้อนหลังของตำบล"
    : isDistrict
      ? "พยากรณ์ย้อนหลังระดับอำเภอ"
      : "คำพยากรณ์ที่ใช้วาดแผนที่ย้อนหลัง";
  const sectionDescription = isSubdistrict
    ? "เลือกเดือนตั้งต้นและระยะพยากรณ์ โดยแสดงเฉพาะข้อมูลของตำบลนี้"
    : isDistrict
      ? "ใช้เดือนตั้งต้นจากตัวเลือกของแผนที่ และรวมผลเฉพาะตำบลที่มีข้อมูลในรอบเดียวกัน"
      : "เลือกเดือนตั้งต้นจากคลังพยากรณ์ แล้วอ่านผลล่วงหน้า 1 ถึง 6 เดือนบนแผนที่";

  if (!selectedMonth) {
    return (
      <DashboardSection
        eyebrow="คลังพยากรณ์ย้อนหลัง"
        title={sectionTitle}
        description="ยังไม่มีชุดพยากรณ์ภัยแล้งที่อ่านได้ จึงไม่สร้างค่าทดแทน"
        provenance="PENDING_SOURCE"
        className={`nr-forecast-archive-mode-section is-${level} is-empty`}
      >
        <EmptyLocalEvidence />
      </DashboardSection>
    );
  }

  const summary = forecastArchiveSummaryForSelection(archive, selectedMonth, selectedHorizon, expectedSubdistrictCodes);
  const issueMonthLabel = formatMonth(summary.issueMonth, "th");
  const selectedRecord =
    isSubdistrict && expectedSubdistrictCodes?.[0]
      ? summary.recordsBySubdistrict.get(expectedSubdistrictCodes[0])
      : undefined;

  return (
    <DashboardSection
      eyebrow="คลังพยากรณ์ย้อนหลัง"
      title={sectionTitle}
      description={sectionDescription}
      provenance="FORECAST_ARCHIVE"
      className={`nr-forecast-archive-mode-section is-${level}`}
    >
      <div className="nr-forecast-archive-mode-body">
        <div className="nr-forecast-archive-mode-copy">
          <div className="nr-forecast-archive-mode-alert">
            <AlertTriangle size={18} aria-hidden="true" />
            <div>
              <strong>ค่าจากการพยากรณ์ ไม่ใช่ข้อมูลความเสียหายทางการ</strong>
              <span>ใช้สำหรับดูสัญญาณล่วงหน้า และต้องอ่านแยกจากสถานการณ์ภัยแล้งย้อนหลัง</span>
            </div>
          </div>
          <p>
            สีแผนที่มาจากคำพยากรณ์รายตำบลของเดือนที่พยากรณ์ และแยกพื้นที่นอกขอบเขตการศึกษาออกจากพื้นที่ไม่มีความเสี่ยง
          </p>
        </div>
        <aside className="nr-forecast-archive-target" aria-label="บริบทเดือนที่พยากรณ์บนแผนที่">
          <span>เดือนที่พยากรณ์บนแผนที่</span>
          <strong>{formatMonth(summary.targetMonth, "th")}</strong>
          <small>
            {forecastHorizonLabel(selectedHorizon)} · เดือนตั้งต้น {issueMonthLabel}
          </small>
        </aside>
      </div>

      {showHorizonSelector ? (
        <DroughtForecastArchiveHorizonSelector
          targetMonth={selectedMonth}
          selectedHorizon={selectedHorizon}
          onHorizonChange={onHorizonChange}
        />
      ) : null}

      <DroughtForecastArchiveSummaryMetrics level={level} summary={summary} selectedRecord={selectedRecord} />
    </DashboardSection>
  );
}

export function DroughtForecastWorkspaceContext({
  level,
  scopeLabel,
  selectedMonth,
  selectedHorizon,
  summary,
}: {
  level: DroughtForecastArchiveLevel;
  scopeLabel: string;
  selectedMonth: NakhonRatchasimaDroughtForecastArchiveTargetMonth;
  selectedHorizon: ForecastArchiveHorizon;
  summary: DroughtForecastArchiveSummary;
}) {
  const contextItems = [
    {
      id: "issue",
      icon: <CalendarDays size={17} />,
      label: "เดือนตั้งต้น (T)",
      value: selectedMonth.labelTh,
      detail: "เดือนเริ่มพยากรณ์ของชุดข้อมูลที่เลือก",
    },
    {
      id: "target",
      icon: <MapPin size={17} />,
      label: "เดือนที่พยากรณ์",
      value: formatMonth(summary.targetMonth, "th"),
      detail: forecastHorizonLabel(selectedHorizon),
    },
    {
      id: "crop",
      icon: <Sprout size={17} />,
      label: "พืชที่ประเมิน",
      value: "ข้าว",
      detail: scopeLabel,
    },
    {
      id: "coverage",
      icon: <Database size={17} />,
      label: "มีค่าพยากรณ์",
      value: `${formatThaiNumber(summary.inScopeSubdistricts)}/${formatThaiNumber(summary.totalSubdistricts)} ตำบล`,
      detail: "ไม่นับตำบลนอกขอบเขตและตำบลที่ไม่มีข้อมูล",
    },
  ];

  return (
    <dl className="nr-drought-workspace-context" aria-label="บริบทพยากรณ์ที่เลือก">
      {contextItems.filter((item) => level !== "subdistrict" || item.id !== "coverage").map((item) => (
        <div key={item.id} className={`is-${item.id}`}>
          <span className="nr-drought-workspace-context-icon" aria-hidden="true">
            {item.icon}
          </span>
          <dt>{item.label}</dt>
          <dd>
            <strong>{item.value}</strong>
            <small>{item.detail}</small>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function DroughtForecastWorkspaceKpiStrip({
  level,
  summary,
  selectedRecord,
}: {
  level: DroughtForecastArchiveLevel;
  summary: DroughtForecastArchiveSummary;
  selectedRecord?: NakhonRatchasimaDroughtForecastArchiveRecord;
}) {
  if (level === "subdistrict") {
    const risk = selectedRecord?.forecastRisk;
    return <MetricGrid className="nr-drought-workspace-kpis is-single" ariaLabel="ผลพยากรณ์ของตำบลที่เลือก" metrics={[{
      label: "ผลพยากรณ์ของตำบล",
      className: `is-forecast-status${risk === undefined ? " is-forecast-missing" : ""}`,
      value: forecastArchiveRecordLabel(selectedRecord),
      detail: risk === null ? "ไม่มีค่าพยากรณ์สำหรับตำบลนี้ ไม่ใช่ผลว่าไม่มีความเสี่ยง"
        : risk === undefined ? "ไม่พบรายการพยากรณ์ของตำบลนี้ในรอบที่เลือก"
          : "ผลจากคลังพยากรณ์ ไม่ใช่การยืนยันความเสียหาย",
      icon: risk === null || risk === undefined ? <Info size={20} /> : risk === 0 ? <ShieldCheck size={20} /> : <ShieldAlert size={20} />,
      tone: risk === 2 ? "danger" : risk === 1 ? "watch" : risk === 0 ? "good" : "muted",
      provenance: selectedRecord ? "FORECAST_ARCHIVE" : "PENDING_SOURCE",
    }]} />;
  }
  const kpis: (SummaryMetric & { id: string })[] = [
    {
      id: "coverage",
      label: "มีค่าพยากรณ์",
      value: `${formatThaiNumber(summary.inScopeSubdistricts)}/${formatThaiNumber(summary.totalSubdistricts)} ตำบล`,
      detail: <><span className="nr-drought-coverage-percent">{formatPercent(summary.totalSubdistricts ? summary.inScopeSubdistricts / summary.totalSubdistricts * 100 : 0)}</span><span className="nr-drought-coverage-context"> ของจำนวนตำบลทั้งหมด</span></>,
      icon: <Database size={17} />,
      tone: "info",
      provenance: "FORECAST_ARCHIVE" as DataProvenanceChipKind,
    },
    {
      id: "no-risk",
      label: "ไม่มีความเสี่ยง",
      value: `${formatThaiNumber(summary.noRiskSubdistricts)} ตำบล`,
      detail: summary.inScopeSubdistricts > 0 ? `${formatPercent(summary.noRiskSubdistricts / summary.inScopeSubdistricts * 100, 1)} ของตำบลที่มีค่าพยากรณ์` : "ไม่มีค่าพยากรณ์ให้ประเมิน",
      icon: <ShieldAlert size={17} />,
      tone: summary.inScopeSubdistricts > 0 ? "good" : "muted",
      provenance: summary.inScopeSubdistricts > 0 ? "FORECAST_ARCHIVE" : "PENDING_SOURCE",
    },
    {
      id: "moderate",
      label: "เสี่ยงปานกลาง",
      value: `${formatThaiNumber(summary.moderateRiskSubdistricts)} ตำบล`,
      detail: summary.inScopeSubdistricts > 0 ? `${formatPercent(summary.moderateRiskSubdistricts / summary.inScopeSubdistricts * 100, 1)} ของตำบลที่มีค่าพยากรณ์` : "ไม่มีค่าพยากรณ์ให้ประเมิน",
      icon: <TrendingUp size={17} />,
      tone: summary.inScopeSubdistricts > 0 ? "watch" : "muted",
      provenance: summary.inScopeSubdistricts > 0 ? "FORECAST_ARCHIVE" : "PENDING_SOURCE",
    },
    {
      id: "high",
      label: "เสี่ยงสูง",
      value: `${formatThaiNumber(summary.highRiskSubdistricts)} ตำบล`,
      detail: summary.inScopeSubdistricts > 0 ? `${formatPercent(summary.highRiskSubdistricts / summary.inScopeSubdistricts * 100, 1)} ของตำบลที่มีค่าพยากรณ์` : "ไม่มีค่าพยากรณ์ให้ประเมิน",
      icon: <AlertTriangle size={17} />,
      tone: summary.inScopeSubdistricts > 0 ? "danger" : "muted",
      provenance: summary.inScopeSubdistricts > 0 ? "FORECAST_ARCHIVE" : "PENDING_SOURCE",
    },
    {
      id: "out-of-scope",
      label: "นอกขอบเขต",
      value: `${formatThaiNumber(summary.outOfScopeSubdistricts)} ตำบล`,
      detail: "ไม่ใช่ไม่มีความเสี่ยง",
      icon: <Info size={17} />,
      tone: "muted",
      provenance: summary.outOfScopeSubdistricts > 0 ? "FORECAST_ARCHIVE" as DataProvenanceChipKind : "PENDING_SOURCE" as DataProvenanceChipKind,
    },
  ];

  if (summary.missingSubdistricts > 0) kpis.push({
    id: "missing", label: "ไม่มีข้อมูล", value: `${formatThaiNumber(summary.missingSubdistricts)} ตำบล`,
    detail: "ไม่พบรายการพยากรณ์", icon: <Info size={17} />, tone: "muted", provenance: "PENDING_SOURCE",
  });

  return (
    <MetricGrid className="nr-drought-workspace-kpis" ariaLabel="สรุปค่าพยากรณ์ที่เลือก">
      <header className="nr-drought-kpi-summary">
        <h3 className="nr-drought-kpi-heading">สรุปเดือน {formatMonth(summary.targetMonth, "th")}</h3>
        <MetricCard {...kpis[0]} className="is-coverage" />
      </header>
      {kpis.slice(1).map(({ id, ...metric }) => <MetricCard key={id} {...metric} className={`is-${id}`} />)}
    </MetricGrid>
  );
}

export function DroughtForecastWorkspaceChart({
  trendMonths,
  selectedHorizon,
  scopeLabel,
  coverageRemark,
}: {
  trendMonths: DroughtForecastTrendMonth[];
  selectedHorizon: ForecastArchiveHorizon;
  scopeLabel: string;
  coverageRemark: string;
}) {
  const [unit, setUnit] = useState<"percent" | "count">("percent");
  const titleId = useId();
  const activeForecastMonth = trendMonths[selectedHorizon - 1] ?? trendMonths[0];
  const forecastHasData = trendMonths.some((month) => month.inScopeSubdistricts > 0);

  return (
    <section className="nr-drought-workspace-chart-card" aria-labelledby={titleId}>
      <div className="nr-drought-workspace-card-heading">
        <div>
          <p className="eyebrow">พยากรณ์ 6 เดือนข้างหน้า</p>
          <h3 id={titleId}>ตำบลเสี่ยงในแต่ละเดือน แยกตามระดับ</h3>
          <span>
            {activeForecastMonth
              ? `เน้น${forecastHorizonLabel(selectedHorizon)} · ${activeForecastMonth.labelTh} · ${scopeLabel}`
              : `ยังไม่มีเดือนพยากรณ์สำหรับ ${scopeLabel}`}
          </span>
        </div>
        <DataProvenanceChip kind={forecastHasData ? "FORECAST_ARCHIVE" : "PENDING_SOURCE"} />
      </div>
      <div className="nr-forecast-chart-toolbar">
        <div className="segmented nr-forecast-unit-control" role="group" aria-label="หน่วยของกราฟพยากรณ์">
          {(["percent", "count"] as const).map((value) => <button key={value} type="button"
            className={unit === value ? "active" : ""} aria-pressed={unit === value} onClick={() => setUnit(value)}>
            {value === "percent" ? <ShieldCheck size={17} aria-hidden="true" /> : <ChartColumn size={17} aria-hidden="true" />}
            <span>{value === "percent" ? <>เปอร์เซ็นต์<span className="nr-chart-percent-suffix" aria-hidden="true"> (%)</span></> : "จำนวนตำบล"}</span>
          </button>)}
        </div>
        <span>{unit === "percent" ? "% ของตำบลที่มีค่าพยากรณ์ในแต่ละเดือน" : "จำนวนตำบลเสี่ยงปานกลาง + เสี่ยงสูง"}</span>
      </div>
      {forecastHasData ? (
        <DroughtForecastTrendGraph
          months={trendMonths}
          unit={unit}
          activeHorizon={selectedHorizon}
        />
      ) : (
        <div className="nr-forecast-unavailable" role="status">
          <Info size={24} aria-hidden="true" />
          <strong>ไม่มีค่าพยากรณ์ให้เปรียบเทียบ</strong>
          <span>ตำบลนอกขอบเขตหรือไม่มีข้อมูล ไม่สามารถสรุปว่าไม่มีความเสี่ยง</span>
        </div>
      )}
      <p className="nr-compact-note nr-forecast-coverage-note">
        <Info size={16} aria-hidden="true" />
        <span>{coverageRemark}</span>
      </p>
    </section>
  );
}

export function DroughtForecastWorkspaceMapCard({
  onHorizonChange,
  irrigation,
  filteredSubdistrictCodes,
  level,
  target,
  onNavigate,
  selectedMonth,
  monthOptions,
  onMonthChange,
  forecastArchive,
  forecastArchiveMonth,
  forecastArchiveHorizon,
  forecastArchiveIssueMonth,
  selectedSubdistrictCode,
  onSelectedSubdistrictChange,
}: {
  onHorizonChange?: (horizon: ForecastArchiveHorizon) => void;
  irrigation?: ForecastMapIrrigation;
  filteredSubdistrictCodes?: string[];
  level: DroughtForecastArchiveLevel;
  target: DroughtForecastWorkspaceTarget;
  onNavigate: (path: string) => void;
  selectedMonth: string;
  monthOptions: AppSelectOption[];
  onMonthChange: (month: string) => void;
  forecastArchive: NakhonRatchasimaDroughtForecastArchive;
  forecastArchiveMonth: NakhonRatchasimaDroughtForecastArchiveTargetMonth;
  forecastArchiveHorizon: ForecastArchiveHorizon;
  forecastArchiveIssueMonth: string;
  selectedSubdistrictCode?: string | null;
  onSelectedSubdistrictChange?: (subdistrictCode: string | null) => void;
}) {
  const title =
    level === "subdistrict"
      ? "แผนที่พยากรณ์ความเสี่ยงภัยแล้งของตำบล"
      : level === "district"
        ? "แผนที่พยากรณ์ความเสี่ยงภัยแล้งระดับตำบล"
        : "แผนที่พยากรณ์ความเสี่ยงภัยแล้ง";
  const issueMonthLabel = formatMonth(forecastArchiveIssueMonth, "th");
  const mapCard = useRef<HTMLElement>(null);
  const populatedFrame = useRef<{ viewportWidth: number; height: number } | null>(null);
  const filteredScope = Boolean(irrigation && irrigation.value !== "all") || filteredSubdistrictCodes?.length === 0;
  useLayoutEffect(() => {
    const card = mapCard.current;
    if (!card || level === "subdistrict" || typeof ResizeObserver === "undefined") return;
    // Only a real viewport resize invalidates the frame. Scrollbars and overlays
    // can briefly change the card width without changing the responsive layout.
    const measure = () => {
      if (document.fullscreenElement) return;
      const { height } = card.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      if (!filteredScope) populatedFrame.current = { viewportWidth, height };
      else if (populatedFrame.current && populatedFrame.current.viewportWidth !== viewportWidth) populatedFrame.current = null;
      if (filteredScope && populatedFrame.current && window.innerWidth > 900) {
        card.style.setProperty("--nr-populated-map-height", `${populatedFrame.current.height}px`);
      } else card.style.removeProperty("--nr-populated-map-height");
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(card);
    return () => observer.disconnect();
  }, [filteredScope, level]);

  return (
    <section ref={mapCard} className={`nr-dashboard-map-card nr-area-map-section nr-drought-workspace-map-card is-${level}`} aria-label={title}>
      <div className="nr-drought-workspace-card-heading nr-dashboard-map-header">
        <div>
          <p className="eyebrow">แผนที่</p>
          <h3>{irrigation?.colorMode === "irrigation" ? "แผนที่สถานะชลประทาน" : `${title} (${forecastHorizonLabel(forecastArchiveHorizon)})`}</h3>
          <span>
            เดือนที่พยากรณ์ {formatMonth(forecastArchiveTargetMonthForSelection(forecastArchiveMonth, forecastArchiveHorizon), "th")} · {forecastHorizonLabel(forecastArchiveHorizon)} จากเดือนตั้งต้น {issueMonthLabel}
          </span>
        </div>
        <DataProvenanceChip kind="FORECAST_ARCHIVE" />
      </div>
      <NakhonRatchasimaLocalMap
        onHorizonChange={onHorizonChange}
        irrigation={irrigation}
        filteredSubdistrictCodes={filteredSubdistrictCodes}
        compactForecast
        target={target}
        onNavigate={onNavigate}
        selectedMonth={selectedMonth}
        monthOptions={monthOptions}
        onMonthChange={onMonthChange}
        forecastArchive={forecastArchive}
        forecastArchiveMonth={forecastArchiveMonth}
        forecastArchiveHorizon={forecastArchiveHorizon}
        forecastArchiveIssueMonth={forecastArchiveIssueMonth}
        selectedSubdistrictCode={selectedSubdistrictCode}
        onSelectedSubdistrictChange={onSelectedSubdistrictChange}
      />
    </section>
  );
}

export function DroughtCompactForecastWorkspace({
  irrigation,
  level,
  title,
  description,
  scopeLabel,
  singleSubdistrict = false,
  archive,
  expectedSubdistrictCodes,
  selectedTargetMonth,
  selectedHorizon,
  onHorizonChange,
  target,
  onNavigate,
  selectedMonth,
  monthOptions,
  onMonthChange,
  selectedSubdistrictCode,
  onSelectedSubdistrictChange,
}: {
  irrigation: ForecastMapIrrigation;
  level: DroughtForecastArchiveLevel;
  title: string;
  description: string;
  scopeLabel: string;
  singleSubdistrict?: boolean;
  archive: NakhonRatchasimaDroughtForecastArchive;
  expectedSubdistrictCodes?: string[];
  selectedTargetMonth: NakhonRatchasimaDroughtForecastArchiveTargetMonth | null;
  selectedHorizon: ForecastArchiveHorizon;
  onHorizonChange: (horizon: ForecastArchiveHorizon) => void;
  target: DroughtForecastWorkspaceTarget;
  onNavigate: (path: string) => void;
  selectedMonth: string;
  monthOptions: AppSelectOption[];
  onMonthChange: (month: string) => void;
  selectedSubdistrictCode?: string | null;
  onSelectedSubdistrictChange?: (subdistrictCode: string | null) => void;
}) {
  if (!selectedTargetMonth) {
    return (
      <DashboardSection
        eyebrow="ข้อมูลพยากรณ์"
        title={title}
        description="ยังไม่มีชุดพยากรณ์ภัยแล้งที่อ่านได้ จึงไม่สร้างค่าทดแทน"
        provenance="PENDING_SOURCE"
        className={`nr-drought-compact-workspace is-${level} is-empty`}
      >
        <EmptyLocalEvidence />
      </DashboardSection>
    );
  }

  const matchingCodes = forecastSubdistrictCodesForIrrigation(archive, irrigation.value, expectedSubdistrictCodes);
  const summary = forecastArchiveSummaryForSelection(archive, selectedTargetMonth, selectedHorizon, matchingCodes);
  const trendMonths = forecastArchiveTrendMonthsForSelection(archive, selectedTargetMonth, matchingCodes);
  const emptyIrrigationScope = matchingCodes.length === 0;
  const forecastCoverageRemark = `${forecastHorizonLabel(selectedHorizon)}: มีค่าพยากรณ์ ${formatThaiNumber(summary.inScopeSubdistricts)}/${formatThaiNumber(summary.totalSubdistricts)} ตำบล · นอกขอบเขต ${formatThaiNumber(summary.outOfScopeSubdistricts)} · ไม่มีข้อมูล ${formatThaiNumber(summary.missingSubdistricts)} ตำบล`;
  const selectedRecord =
    level === "subdistrict" && expectedSubdistrictCodes?.[0]
      ? summary.recordsBySubdistrict.get(expectedSubdistrictCodes[0])
      : undefined;

  const navigateWithForecast = (path: string) => onNavigate(pathWithForecastSelection(path, selectedTargetMonth.period, selectedHorizon, irrigation.value));
  const attentionRecords = [...summary.recordsBySubdistrict.values()]
    .filter((record) => record.forecastRisk === 1 || record.forecastRisk === 2)
    .sort((a, b) => (b.forecastRisk ?? 0) - (a.forecastRisk ?? 0) || a.subdistrictCode.localeCompare(b.subdistrictCode));

  const heading = <div className="nr-drought-workspace-head">
    <div><p className="eyebrow">ข้อมูลพยากรณ์</p><h2 id={`nr-drought-compact-workspace-${level}`}>{title}</h2><p>{description}</p></div>
    <DataProvenanceChip kind="FORECAST_ARCHIVE" />
  </div>;
  const targetNote = <p className="nr-forecast-target-note">เดือนตั้งต้น {selectedTargetMonth.labelTh} · พยากรณ์ล่วงหน้า 1–6 เดือน: {trendMonths[0]?.labelTh} – {trendMonths.at(-1)?.labelTh}</p>;
  const horizonSelector = <div className="nr-drought-workspace-horizon">
    <DroughtForecastArchiveHorizonSelector targetMonth={selectedTargetMonth} selectedHorizon={selectedHorizon} onHorizonChange={onHorizonChange} />
  </div>;
  const context = <DroughtForecastWorkspaceContext level={level} scopeLabel={scopeLabel} selectedMonth={selectedTargetMonth} selectedHorizon={selectedHorizon} summary={summary} />;
  const guidance = <DroughtOperationalDisclosure key="guidance" className="nr-operational-guidance" title="คำแนะนำและข้อควรระวัง" description="ตรวจสอบข้อมูลพื้นที่ก่อนตัดสินใจ">
    <ul><li>ตรวจสอบพื้นที่ที่มีสัญญาณเสี่ยงกับข้อมูลภาคสนาม</li><li>เทียบพยากรณ์กับข้อมูลย้อนหลัง</li><li>ประสานหน่วยงานในพื้นที่ก่อนวางแผนจัดการน้ำ</li></ul>
    <p>พยากรณ์ล่วงหน้า 1 ถึง 6 เดือนจากเดือนตั้งต้นที่เลือก แม้เลือกเดือนตั้งต้นในอดีต เดือนที่พยากรณ์ก็ยังเดินไปข้างหน้า ไม่ใช่การยืนยันความเสียหายทางการ</p>
    {level !== "subdistrict" && <p>สัดส่วนคิดจากตำบลที่มีค่าพยากรณ์ 0, 1 หรือ 2 ในแต่ละเดือน ไม่รวมตำบลนอกขอบเขตและไม่มีข้อมูล ความเสี่ยงปานกลางและสูงแยกตามค่าต้นฉบับ ไม่ใช่ระดับความรุนแรงทั้งอำเภอหรือสัดส่วนเนื้อที่</p>}
    <p>เดือนตั้งต้น (T) คือเดือนของข้อมูลต้นทาง เดือนที่พยากรณ์คำนวณโดยบวกจำนวนเดือนล่วงหน้า ข้อมูลนี้ระบุเป็นรายเดือน ไม่ได้ระบุวันออกพยากรณ์</p>
  </DroughtOperationalDisclosure>;

  return (
    <>
    <DroughtWorkspaceHeader target={target} archiveLabel={formatMonth(archive.meta.targetMonthEnd, "th")} onNavigate={navigateWithForecast} />
    <DroughtWorkspaceFilters target={target} selectedMonth={selectedMonth} monthOptions={monthOptions} onMonthChange={onMonthChange}
      selectedHorizon={selectedHorizon} onHorizonChange={onHorizonChange} onNavigate={navigateWithForecast} />
    <section className={`nr-drought-compact-workspace is-${level}${emptyIrrigationScope ? " is-empty-scope" : ""}`} aria-labelledby={`nr-drought-compact-workspace-${level}`}>
      {level !== "subdistrict" && <>{heading}{targetNote}</>}

      <div className="nr-drought-workspace-body">
        {level === "subdistrict" ? <div className="nr-subdistrict-forecast-intro">{heading}{targetNote}{horizonSelector}</div> : horizonSelector}

        {level === "subdistrict" ? <section className="nr-subdistrict-forecast-context" aria-labelledby="nr-subdistrict-context-title">
          <h3 id="nr-subdistrict-context-title">ข้อมูลคาดการณ์ ({forecastHorizonLabel(selectedHorizon)})</h3>
          {context}
          <p className="nr-subdistrict-forecast-note"><Info size={18} aria-hidden="true" /><span>พยากรณ์ {formatMonth(summary.targetMonth, "th")}<small>ล่วงหน้า {selectedHorizon} เดือน จากเดือนตั้งต้น {selectedTargetMonth.labelTh}</small></span></p>
        </section> : context}

        {emptyIrrigationScope ? <IrrigationEmptyState className="nr-drought-workspace-kpis" onReset={() => irrigation.onChange("all")} />
          : <DroughtForecastWorkspaceKpiStrip level={level} summary={summary} selectedRecord={selectedRecord} />}

        <div className="nr-drought-workspace-main">
          {level !== "subdistrict" && !emptyIrrigationScope && (
            <DroughtForecastWorkspaceChart
              trendMonths={trendMonths}
              selectedHorizon={selectedHorizon}
              scopeLabel={scopeLabel}
              coverageRemark={forecastCoverageRemark}
            />
          )}
          <DroughtForecastWorkspaceMapCard
            onHorizonChange={onHorizonChange}
            irrigation={irrigation}
            filteredSubdistrictCodes={irrigation.value === "all" ? undefined : matchingCodes}
            level={level}
            target={target}
            onNavigate={navigateWithForecast}
            selectedMonth={selectedMonth}
            monthOptions={monthOptions}
            onMonthChange={onMonthChange}
            forecastArchive={archive}
            forecastArchiveMonth={selectedTargetMonth}
            forecastArchiveHorizon={selectedHorizon}
            forecastArchiveIssueMonth={summary.issueMonth}
            selectedSubdistrictCode={selectedSubdistrictCode}
            onSelectedSubdistrictChange={onSelectedSubdistrictChange}
          />
        </div>
        {level === "subdistrict" && guidance}
      </div>
    </section>
    {level !== "subdistrict" && <DroughtOperationalDisclosureGroup>
      {!emptyIrrigationScope && <DroughtOperationalSummary key="risk-summary"
        horizon={selectedHorizon} summary={summary}
      />}
      {attentionRecords.length > 0 && <DroughtOperationalDisclosure key="attention" title="ตำบลภัยแล้งที่ควรตรวจสอบ" icon="map"
        description={`เสี่ยงสูง ${formatThaiNumber(summary.highRiskSubdistricts)} · ปานกลาง ${formatThaiNumber(summary.moderateRiskSubdistricts)} ตำบล`}>
        <ul className="nr-operational-attention-list">{attentionRecords.map((record) => <li key={record.subdistrictCode}>
          <button type="button" onClick={() => { const path = pathForSubdistrictCode(record.subdistrictCode); if (path) navigateWithForecast(path); }}>
            <span>ต.{record.subdistrictNameTh} · อ.{record.districtNameTh}</span><strong>{record.riskLabelTh}</strong>
          </button>
        </li>)}</ul>
        <p>เรียงตามระดับพยากรณ์ แล้วตามรหัสตำบล ไม่ใช่การจัดอันดับความเสียหาย</p>
      </DroughtOperationalDisclosure>}
      {guidance}
    </DroughtOperationalDisclosureGroup>}
    </>
  );
}
