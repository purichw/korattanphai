import {
  type NakhonRatchasimaDroughtForecastArchive,
  type NakhonRatchasimaDroughtForecastArchiveTargetMonth,
  type NakhonRatchasimaDroughtForecastArchiveRecord,
  type NakhonRatchasimaMapLayer,
} from "../../types";
import { formatMonth } from "../../i18n";
import {
  TrendingUp,
  Database,
  LocateFixed,
  ShieldAlert,
  AlertTriangle,
  MapPin,
  CalendarDays,
  Info,
  ChevronDown,
  Sprout,
} from "lucide-react";
import { formatThaiNumber, type LocalMapMode, formatPercent, pathForSubdistrictCode, useMediaQuery } from "./workspaceModel";
import { DroughtWorkspaceHeader, DroughtWorkspaceFilters, DroughtOperationalDisclosure } from "./DroughtOperationalWorkspace";
import {
  type DroughtForecastTrendMonth,
  type ForecastArchiveHorizon,
  droughtForecastBand,
  highestDroughtForecastBand,
  droughtForecastBandLabel,
  type DroughtForecastArchiveLevel,
  forecastArchiveSummaryForSelection,
  type DroughtForecastArchiveSummary,
  forecastArchiveRecordLabel,
  droughtForecastHasRiskSignal,
  type DroughtForecastWorkspaceTarget,
  forecastArchiveTrendMonthsForSelection,
  pathWithForecastSelection,
} from "./forecastModel";
import { DashboardSection, EmptyLocalEvidence } from "./SharedPanels";
import { DroughtForecastArchiveHorizonSelector, DroughtForecastArchiveSummaryMetrics } from "./ForecastControls";
import { type DataProvenanceChipKind, DataProvenanceChip } from "../DataProvenanceChip";
import { type AppSelectOption } from "../AppSelect";
import { NakhonRatchasimaLocalMap } from "./NakhonRatchasimaLocalMap";
import { MetricGrid, type SummaryMetric } from "../PageSummary";

export function DroughtForecastTrendGraph({
  months,
  totalSubdistricts,
  singleSubdistrict = false,
  activeHorizon,
}: {
  months: DroughtForecastTrendMonth[];
  totalSubdistricts: number;
  singleSubdistrict?: boolean;
  activeHorizon?: ForecastArchiveHorizon;
}) {
  const compactChart = useMediaQuery("(max-width: 720px)");
  const width = compactChart ? 360 : 720;
  const height = compactChart ? 230 : 300;
  const padding = { top: 28, right: compactChart ? 20 : 34, bottom: 52, left: compactChart ? 34 : 62 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const denominator = Math.max(...months.map((month) => month.totalSubdistricts), totalSubdistricts, 1);
  const threshold = Math.round(denominator * 0.5);
  const xStep = months.length > 1 ? plotWidth / (months.length - 1) : 0;
  const yForValue = (value: number) => padding.top + (1 - Math.min(value, denominator) / denominator) * plotHeight;
  const points = months.map((month, index) => ({
    month,
    band: droughtForecastBand(month),
    isActive: activeHorizon === index + 1,
    x: padding.left + xStep * index,
    y: yForValue(month.riskSubdistricts),
  }));
  const zeroY = yForValue(0);
  const thresholdY = yForValue(threshold);
  const areaPath = [
    `M ${points[0]?.x ?? padding.left} ${zeroY}`,
    ...points.map((point) => `L ${point.x} ${point.y}`),
    `L ${points[points.length - 1]?.x ?? padding.left} ${zeroY}`,
    "Z",
  ].join(" ");
  const guideValues = Array.from(new Set([0, Math.round(denominator * 0.25), threshold, Math.round(denominator * 0.75), denominator])).sort(
    (a, b) => a - b,
  );
  const segments = points.slice(1).map((point, index) => {
    const from = points[index]!;
    return {
      from,
      to: point,
      band: highestDroughtForecastBand(from.band, point.band),
    };
  });

  return (
    <figure className="nr-forecast-line-graph nr-drought-forecast-graph">
      <svg
        className="nr-forecast-line-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="กราฟพยากรณ์จำนวนตำบลเสี่ยงภัยแล้ง 6 เดือน"
      >
        <title>กราฟพยากรณ์จำนวนตำบลเสี่ยงภัยแล้ง 6 เดือน</title>
        {guideValues.map((value) => {
          const y = yForValue(value);
          return (
            <g key={value} className="nr-forecast-graph-guide">
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} />
              <text x={padding.left - 10} y={y + 4}>{formatThaiNumber(value, 0)}</text>
            </g>
          );
        })}
        <path className="nr-drought-forecast-graph-area" d={areaPath} />
        <line
          className="nr-drought-forecast-graph-threshold"
          x1={padding.left}
          y1={thresholdY}
          x2={width - padding.right}
          y2={thresholdY}
        />
        {segments.map((segment) => (
          <line
            key={`${segment.from.month.period}-${segment.to.month.period}`}
            className={`nr-drought-forecast-line-segment is-${segment.band}`}
            x1={segment.from.x}
            y1={segment.from.y}
            x2={segment.to.x}
            y2={segment.to.y}
          />
        ))}
        {points.map((point, index) => (
          <g key={point.month.period} className={`nr-forecast-point-group${point.isActive ? " is-active" : ""}`}>
            <title>
              T+{index + 1} · {point.month.labelTh} · {droughtForecastBandLabel(point.band, singleSubdistrict ? "single" : "area")} · {formatThaiNumber(point.month.riskSubdistricts)} ตำบล
            </title>
            <circle className={`nr-drought-forecast-point is-${point.band}`} cx={point.x} cy={point.y} r={point.isActive ? "9" : "7"} />
            <text className={`nr-drought-forecast-point-label is-${point.band}`} x={point.x} y={point.y - 14}>
              {formatThaiNumber(point.month.riskSubdistricts)}
            </text>
            <text className="nr-forecast-axis-date" x={point.x} y={height - 12}>
              {point.month.labelTh.replace(/\s+\d{4}$/, "")}
            </text>
          </g>
        ))}
        <text className="nr-forecast-axis-unit" x={padding.left - 8} y={padding.top - 10}>ตำบล</text>
      </svg>
      <figcaption className="nr-forecast-line-legend nr-drought-forecast-legend">
        <span><i className="is-normal" />{singleSubdistrict ? "ไม่เสี่ยง" : "ไม่พบพื้นที่เสี่ยง"}</span>
        <span><i className="is-watch" />{singleSubdistrict ? "เสี่ยงแล้ง" : "มีพื้นที่เสี่ยง"}</span>
        <span><i className="is-severe" />{singleSubdistrict ? "เสี่ยงแล้ง" : "เกินครึ่งพื้นที่"}</span>
        <span className="nr-drought-forecast-threshold-label"><i className="is-threshold" />
          {singleSubdistrict ? "เส้นอ้างอิงเมื่อพบความเสี่ยง" : `เกณฑ์ครึ่งพื้นที่ ${formatThaiNumber(threshold)} ตำบล`}
        </span>
      </figcaption>
    </figure>
  );
}

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
    ? "เลือกรอบพยากรณ์ตาม T+ ของเดือนเป้าหมาย โดยแสดงเฉพาะข้อมูลของตำบลนี้"
    : isDistrict
      ? "ใช้เดือนเป้าหมายจาก dropdown เดิมของแผนที่ และรวมผลเฉพาะตำบลที่มีข้อมูลในรอบเดียวกัน"
      : "เลือกกรอบพยากรณ์ T+1 ถึง T+6 จากคลังพยากรณ์ย้อนหลัง แล้วอ่านผลบนแผนที่เป้าหมายเดียวกัน";

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
      provenance="REAL"
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
            แผนที่ด้านล่างใช้สีจากคำพยากรณ์รายตำบลของเดือนเป้าหมาย และแยกพื้นที่นอกขอบเขตการศึกษาออกจากพื้นที่ไม่มีความเสี่ยง
          </p>
        </div>
        <aside className="nr-forecast-archive-target" aria-label="บริบทเดือนเป้าหมายของแผนที่พยากรณ์">
          <span>เป้าหมายบนแผนที่</span>
          <strong>{selectedMonth.labelTh}</strong>
          <small>
            T+{selectedHorizon} จากรอบข้อมูล {issueMonthLabel}
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
  const issueMonthLabel = formatMonth(summary.issueMonth, "th");
  const contextItems = [
    {
      id: "target",
      icon: <MapPin size={17} />,
      label: "เป้าหมาย",
      value: selectedMonth.labelTh,
      detail: `แผนที่ใช้ T+${selectedHorizon}`,
    },
    {
      id: "issue",
      icon: <CalendarDays size={17} />,
      label: "ออก/อ้างอิง",
      value: issueMonthLabel,
      detail: "รอบข้อมูลของ T+ ที่เลือก",
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
      label: "ครอบคลุม",
      value: `${formatThaiNumber(summary.matchedSubdistricts)}/${formatThaiNumber(summary.totalSubdistricts)} ตำบล`,
      detail: summary.missingSubdistricts > 0 ? `${formatThaiNumber(summary.missingSubdistricts)} ตำบลไม่มี record` : "พร้อมวาดแผนที่",
    },
  ];

  return (
    <dl className="nr-drought-workspace-context" aria-label="บริบทพยากรณ์ที่เลือก">
      {contextItems.map((item) => (
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
  summary,
}: {
  level: DroughtForecastArchiveLevel;
  summary: DroughtForecastArchiveSummary;
  selectedRecord?: NakhonRatchasimaDroughtForecastArchiveRecord;
}) {
  const kpis: (SummaryMetric & { id: string })[] = [
    {
      id: "coverage",
      label: "ครอบคลุม",
      value: `${formatThaiNumber(summary.matchedSubdistricts)}/${formatThaiNumber(summary.totalSubdistricts)} ตำบล`,
      detail: `${formatPercent(summary.totalSubdistricts ? summary.matchedSubdistricts / summary.totalSubdistricts * 100 : 0)} มีรายการพยากรณ์`,
      icon: <Database size={17} />,
      tone: "info",
      provenance: "REAL" as DataProvenanceChipKind,
    },
    {
      id: "no-risk",
      label: "ไม่มีความเสี่ยง",
      value: `${formatThaiNumber(summary.noRiskSubdistricts)} ตำบล`,
      detail: "ผลพยากรณ์: ไม่พบสัญญาณเสี่ยง",
      icon: <ShieldAlert size={17} />,
      tone: "good",
      provenance: "REAL" as DataProvenanceChipKind,
    },
    {
      id: "moderate",
      label: "เสี่ยงปานกลาง",
      value: `${formatThaiNumber(summary.moderateRiskSubdistricts)} ตำบล`,
      detail: "ผลพยากรณ์: เสี่ยงปานกลาง",
      icon: <TrendingUp size={17} />,
      tone: "watch",
      provenance: summary.matchedSubdistricts > 0 ? "REAL" as DataProvenanceChipKind : "PENDING_SOURCE" as DataProvenanceChipKind,
    },
    {
      id: "high",
      label: "เสี่ยงสูง",
      value: `${formatThaiNumber(summary.highRiskSubdistricts)} ตำบล`,
      detail: "ผลพยากรณ์: เสี่ยงสูง",
      icon: <AlertTriangle size={17} />,
      tone: "danger",
      provenance: summary.matchedSubdistricts > 0 ? "REAL" as DataProvenanceChipKind : "PENDING_SOURCE" as DataProvenanceChipKind,
    },
    {
      id: "out-of-scope",
      label: "นอกขอบเขต",
      value: `${formatThaiNumber(summary.outOfScopeSubdistricts)} ตำบล`,
      detail: "ไม่ใช่ไม่มีความเสี่ยง",
      icon: <Info size={17} />,
      tone: "muted",
      provenance: summary.outOfScopeSubdistricts > 0 ? "REAL" as DataProvenanceChipKind : "PENDING_SOURCE" as DataProvenanceChipKind,
    },
  ];

  if (summary.missingSubdistricts > 0) kpis.push({
    id: "missing", label: "ไม่มีข้อมูล", value: `${formatThaiNumber(summary.missingSubdistricts)} ตำบล`,
    detail: "ไม่พบรายการพยากรณ์", icon: <Info size={17} />, tone: "muted", provenance: "PENDING_SOURCE",
  });

  return (
    <MetricGrid className="nr-drought-workspace-kpis" ariaLabel="สรุปค่าพยากรณ์ที่เลือก"
      metrics={kpis.map(({ id, ...metric }) => ({ ...metric, className: `is-${id}` }))} />
  );
}

export function DroughtForecastWorkspaceChart({
  forecastHasData,
  trendMonths,
  selectedHorizon,
  singleSubdistrict = false,
  scopeLabel,
  coverageRemark,
}: {
  forecastHasData: boolean;
  trendMonths: DroughtForecastTrendMonth[];
  selectedHorizon: ForecastArchiveHorizon;
  singleSubdistrict?: boolean;
  scopeLabel: string;
  coverageRemark: string;
}) {
  const activeForecastMonth = trendMonths[selectedHorizon - 1] ?? trendMonths[0];
  const totalSubdistricts = Math.max(...trendMonths.map((month) => month.totalSubdistricts), 1);

  return (
    <section className="nr-drought-workspace-chart-card" aria-labelledby="nr-drought-workspace-chart-title">
      <div className="nr-drought-workspace-card-heading">
        <div>
          <p className="eyebrow">แนวโน้ม 6 เดือน</p>
          <h3 id="nr-drought-workspace-chart-title">แนวโน้มจำนวนตำบลที่เสี่ยงภัยแล้ง</h3>
          <span>
            {activeForecastMonth
              ? `เน้น T+${selectedHorizon} · ${activeForecastMonth.labelTh} สำหรับ ${scopeLabel}`
              : `ยังไม่มีเดือนพยากรณ์สำหรับ ${scopeLabel}`}
          </span>
        </div>
        <DataProvenanceChip kind={forecastHasData ? "REAL" : "PENDING_SOURCE"} />
      </div>
      {forecastHasData ? (
        <DroughtForecastTrendGraph
          months={trendMonths}
          totalSubdistricts={totalSubdistricts}
          singleSubdistrict={singleSubdistrict}
          activeHorizon={selectedHorizon}
        />
      ) : (
        <EmptyLocalEvidence />
      )}
      <p className={`nr-compact-note${forecastHasData && !droughtForecastHasRiskSignal(trendMonths) ? " nr-forecast-remark" : ""}`}>
        {forecastHasData
          ? coverageRemark
          : "ยังไม่มีรายการพยากรณ์ภัยแล้งของพื้นที่นี้ในรอบข้อมูลพยากรณ์"}
      </p>
    </section>
  );
}

export function DroughtForecastWorkspaceMapCard({
  readinessMap = false,
  onCloseReadinessMap,
  level,
  target,
  layer,
  mapMode,
  onMapModeChange,
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
  readinessMap?: boolean;
  onCloseReadinessMap?: () => void;
  level: DroughtForecastArchiveLevel;
  target: DroughtForecastWorkspaceTarget;
  layer: NakhonRatchasimaMapLayer;
  mapMode: LocalMapMode;
  onMapModeChange: (mode: LocalMapMode) => void;
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

  return (
    <section className={`nr-dashboard-map-card nr-area-map-section nr-drought-workspace-map-card is-${level}`} aria-label={title}>
      <div className="nr-drought-workspace-card-heading nr-dashboard-map-header">
        <div>
          <p className="eyebrow">แผนที่</p>
          <h3>{readinessMap ? "แผนที่ความพร้อมข้อมูลพื้นที่" : `${title} (T+${forecastArchiveHorizon})`}</h3>
          <span>
            เดือนเป้าหมาย {forecastArchiveMonth.labelTh} · T+{forecastArchiveHorizon} จากรอบข้อมูล {issueMonthLabel}
          </span>
        </div>
        <DataProvenanceChip kind="REAL" />
      </div>
      {readinessMap && <button type="button" className="secondary-button nr-return-forecast" onClick={onCloseReadinessMap}>กลับแผนที่พยากรณ์</button>}
      <NakhonRatchasimaLocalMap
        compactForecast
        researchCriteriaEnabled={!readinessMap}
        target={target}
        layer={layer}
        mapMode={readinessMap ? "prediction-readiness" : mapMode}
        onMapModeChange={onMapModeChange}
        onNavigate={onNavigate}
        selectedMonth={selectedMonth}
        monthOptions={monthOptions}
        onMonthChange={onMonthChange}
        forecastArchive={readinessMap ? undefined : forecastArchive}
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
  readinessMap = false,
  onCloseReadinessMap,
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
  layer,
  mapMode,
  onMapModeChange,
  onNavigate,
  selectedMonth,
  monthOptions,
  onMonthChange,
  selectedSubdistrictCode,
  onSelectedSubdistrictChange,
}: {
  readinessMap?: boolean;
  onCloseReadinessMap?: () => void;
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
  layer: NakhonRatchasimaMapLayer;
  mapMode: LocalMapMode;
  onMapModeChange: (mode: LocalMapMode) => void;
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

  const summary = forecastArchiveSummaryForSelection(archive, selectedTargetMonth, selectedHorizon, expectedSubdistrictCodes);
  const trendMonths = forecastArchiveTrendMonthsForSelection(archive, selectedTargetMonth, expectedSubdistrictCodes);
  const forecastHasData = summary.matchedSubdistricts > 0;
  const forecastCoverageRemark = (() => {
    if (!forecastHasData) return "ยังไม่มีรายการพยากรณ์ภัยแล้งของพื้นที่นี้ในรอบข้อมูลพยากรณ์";
    if (level === "subdistrict") {
      return summary.riskSubdistricts > 0
        ? "ตำบลนี้มีสัญญาณเสี่ยงในกรอบพยากรณ์ที่เลือก"
        : "กราฟเป็น 0 ในกรอบที่เลือก เพราะคลังพยากรณ์ระบุว่าไม่มีสัญญาณเสี่ยงหรืออยู่นอกขอบเขตการศึกษา";
    }
    const coverage = `ครอบคลุม ${formatThaiNumber(summary.matchedSubdistricts)}/${formatThaiNumber(summary.totalSubdistricts)} ตำบล`;
    return summary.riskSubdistricts > 0
      ? `กรองคลังพยากรณ์ตามรหัสพื้นที่ ${coverage} มีพื้นที่ขาดข้อมูล ${formatThaiNumber(summary.missingSubdistricts)} ตำบล`
      : `กราฟเป็น 0 ในกรอบที่เลือก เพราะคลังพยากรณ์ระบุว่าไม่มีสัญญาณเสี่ยงหลังกรองตามรหัสพื้นที่ (${coverage})`;
  })();
  const selectedRecord =
    level === "subdistrict" && expectedSubdistrictCodes?.[0]
      ? summary.recordsBySubdistrict.get(expectedSubdistrictCodes[0])
      : undefined;

  const navigateWithForecast = (path: string) => onNavigate(pathWithForecastSelection(path, selectedTargetMonth.period, selectedHorizon));
  const changeHorizon = (horizon: ForecastArchiveHorizon) => { onCloseReadinessMap?.(); onHorizonChange(horizon); };
  const changeMonth = (month: string) => { onCloseReadinessMap?.(); onMonthChange(month); };
  const attentionRecords = [...summary.recordsBySubdistrict.values()]
    .filter((record) => record.forecastRisk === 1 || record.forecastRisk === 2)
    .sort((a, b) => (b.forecastRisk ?? 0) - (a.forecastRisk ?? 0) || a.subdistrictCode.localeCompare(b.subdistrictCode));

  return (
    <>
    <DroughtWorkspaceHeader target={target} archiveLabel={formatMonth(archive.meta.targetMonthEnd, "th")} onNavigate={navigateWithForecast} />
    <DroughtWorkspaceFilters target={target} selectedMonth={selectedMonth} monthOptions={monthOptions} onMonthChange={changeMonth}
      selectedHorizon={selectedHorizon} onHorizonChange={changeHorizon} onNavigate={navigateWithForecast} />
    <section className={`nr-drought-compact-workspace is-${level}`} aria-labelledby={`nr-drought-compact-workspace-${level}`}>
      <div className="nr-drought-workspace-head">
        <div>
          <p className="eyebrow">ข้อมูลพยากรณ์</p>
          <h2 id={`nr-drought-compact-workspace-${level}`}>{title}</h2>
          <p>{description}</p>
        </div>
        <DataProvenanceChip kind="REAL" />
      </div>

      <div className="nr-drought-workspace-body">
        <div className="nr-drought-workspace-horizon">
          <DroughtForecastArchiveHorizonSelector
            targetMonth={selectedTargetMonth}
            selectedHorizon={selectedHorizon}
            onHorizonChange={changeHorizon}
          />
        </div>

        <DroughtForecastWorkspaceContext
          level={level}
          scopeLabel={scopeLabel}
          selectedMonth={selectedTargetMonth}
          selectedHorizon={selectedHorizon}
          summary={summary}
        />

        <div className="nr-drought-workspace-main">
          <DroughtForecastWorkspaceChart
            forecastHasData={forecastHasData}
            trendMonths={trendMonths}
            selectedHorizon={selectedHorizon}
            singleSubdistrict={singleSubdistrict}
            scopeLabel={scopeLabel}
            coverageRemark={forecastCoverageRemark}
          />
          <DroughtForecastWorkspaceMapCard
            readinessMap={readinessMap}
            onCloseReadinessMap={onCloseReadinessMap}
            level={level}
            target={target}
            layer={layer}
            mapMode={mapMode}
            onMapModeChange={onMapModeChange}
            onNavigate={navigateWithForecast}
            selectedMonth={selectedMonth}
            monthOptions={monthOptions}
            onMonthChange={changeMonth}
            forecastArchive={archive}
            forecastArchiveMonth={selectedTargetMonth}
            forecastArchiveHorizon={selectedHorizon}
            forecastArchiveIssueMonth={summary.issueMonth}
            selectedSubdistrictCode={selectedSubdistrictCode}
            onSelectedSubdistrictChange={onSelectedSubdistrictChange}
          />
        </div>

        <DroughtForecastWorkspaceKpiStrip level={level} summary={summary} selectedRecord={selectedRecord} />

        <details className="nr-drought-workspace-details">
          <summary className="secondary-button">
            <span>ดูรายละเอียดเพิ่มเติม</span>
            <ChevronDown size={16} aria-hidden="true" />
          </summary>
          <div className="nr-drought-workspace-details-body">
            <DroughtForecastArchivePanel
              archive={archive}
              level={level}
              expectedSubdistrictCodes={expectedSubdistrictCodes}
              selectedTargetMonth={selectedTargetMonth}
              selectedHorizon={selectedHorizon}
              onHorizonChange={onHorizonChange}
              showHorizonSelector={false}
            />
          </div>
        </details>
      </div>
    </section>
    <div className="nr-operational-forecast-actions">
      <div className={`nr-operational-forecast-summary${summary.riskSubdistricts > 0 ? " has-risk" : summary.inScopeSubdistricts === 0 ? " has-no-data" : ""}`}>
        <TrendingUp size={22} aria-hidden="true" />
        <div><h3>สรุปผลพยากรณ์ (T+{selectedHorizon})</h3>
          <strong>{selectedRecord ? forecastArchiveRecordLabel(selectedRecord) : `พบพื้นที่เสี่ยง ${formatThaiNumber(summary.riskSubdistricts)} ตำบล`}</strong>
          <small>อยู่ในขอบเขต {formatThaiNumber(summary.inScopeSubdistricts)}/{formatThaiNumber(summary.totalSubdistricts)} ตำบล</small>
        </div>
      </div>
      <DroughtOperationalDisclosure title="ตำบลภัยแล้งที่ควรตรวจสอบ" icon="map"
        description={attentionRecords.length ? `เสี่ยงสูง ${formatThaiNumber(summary.highRiskSubdistricts)} · ปานกลาง ${formatThaiNumber(summary.moderateRiskSubdistricts)} ตำบล` : "ไม่พบสัญญาณเสี่ยงในรายการพยากรณ์ที่มีข้อมูล"}>
        <ul className="nr-operational-attention-list">{attentionRecords.map((record) => <li key={record.subdistrictCode}>
          <button type="button" onClick={() => { const path = pathForSubdistrictCode(record.subdistrictCode); if (path) navigateWithForecast(path); }}>
            <span>ต.{record.subdistrictNameTh} · อ.{record.districtNameTh}</span><strong>{record.riskLabelTh}</strong>
          </button>
        </li>)}</ul>
        <p>ใช้จัดลำดับการตรวจสอบภาคสนาม ไม่ใช่การยืนยันความเสียหาย</p>
      </DroughtOperationalDisclosure>
      <DroughtOperationalDisclosure className="nr-operational-guidance" title="คำแนะนำและข้อควรระวัง" description="ตรวจสอบข้อมูลพื้นที่ก่อนตัดสินใจ">
        <ul><li>ตรวจสอบพื้นที่ที่มีสัญญาณเสี่ยงกับข้อมูลภาคสนาม</li><li>เทียบพยากรณ์กับข้อมูลย้อนหลังและความพร้อมข้อมูล</li><li>ประสานหน่วยงานในพื้นที่ก่อนวางแผนจัดการน้ำ</li></ul>
        <p>กรอบ T+1 ถึง T+6 เป็นหลายรอบพยากรณ์ของเดือนเป้าหมายเดียวกัน ไม่ใช่สถานการณ์ปัจจุบันหรือการยืนยันความเสียหายทางการ</p>
      </DroughtOperationalDisclosure>
    </div>
    </>
  );
}
