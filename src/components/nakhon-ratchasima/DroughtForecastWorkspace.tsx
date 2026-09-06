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
  ShieldCheck,
  AlertTriangle,
  MapPin,
  CalendarDays,
  Info,
  Sprout,
} from "lucide-react";
import { formatThaiNumber, type LocalMapMode, formatPercent, pathForSubdistrictCode, useMediaQuery } from "./workspaceModel";
import { DroughtWorkspaceHeader, DroughtWorkspaceFilters, DroughtOperationalDisclosure, DroughtOperationalSummary } from "./DroughtOperationalWorkspace";
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
  type DroughtForecastWorkspaceTarget,
  forecastArchiveTrendMonthsForSelection,
  forecastArchiveTargetMonthForSelection,
  pathWithForecastSelection,
} from "./forecastModel";
import { DashboardSection, EmptyLocalEvidence } from "./SharedPanels";
import { DroughtForecastArchiveHorizonSelector, DroughtForecastArchiveSummaryMetrics } from "./ForecastControls";
import { forecastSubdistrictCodesForIrrigation } from "../../irrigation";
import type { ForecastMapIrrigation } from "../IrrigationStatusSelect";
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
  }).filter(({ from, to }) => from.band !== "unavailable" && to.band !== "unavailable");

  return (
    <figure className="nr-forecast-line-graph nr-drought-forecast-graph">
      <svg
        className="nr-forecast-line-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="แนวโน้มจำนวนตำบลเสี่ยงภัยแล้ง 6 เดือนข้างหน้า"
      >
        <title>แนวโน้มจำนวนตำบลเสี่ยงภัยแล้ง 6 เดือนข้างหน้า</title>
        {guideValues.map((value) => {
          const y = yForValue(value);
          return (
            <g key={value} className="nr-forecast-graph-guide">
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} />
              <text x={padding.left - 10} y={y + 4}>{formatThaiNumber(value, 0)}</text>
            </g>
          );
        })}
        {segments.map(({ from, to }) => <path key={to.month.period} className="nr-drought-forecast-graph-area"
          d={`M ${from.x} ${zeroY} L ${from.x} ${from.y} L ${to.x} ${to.y} L ${to.x} ${zeroY} Z`} />)}
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
        {points.map((point) => (
          <g key={point.month.period} className={`nr-forecast-point-group${point.isActive ? " is-active" : ""}`}>
            <title>
              T+{point.month.monthIndex} · {point.month.labelTh} · {droughtForecastBandLabel(point.band, singleSubdistrict ? "single" : "area")}
              {point.band !== "unavailable" ? ` · ${formatThaiNumber(point.month.riskSubdistricts)} ตำบลเสี่ยง` : ""}
              {` · มีค่าพยากรณ์ ${point.month.inScopeSubdistricts}/${point.month.totalSubdistricts} ตำบล · นอกขอบเขต ${point.month.outOfScopeSubdistricts} · ไม่มีข้อมูล ${point.month.missingSubdistricts}`}
            </title>
            {point.band !== "unavailable" && <circle className={`nr-drought-forecast-point is-${point.band}`} cx={point.x} cy={point.y} r={point.isActive ? "9" : "7"} />}
            <text className={`nr-drought-forecast-point-label is-${point.band}`} x={point.x} y={point.y - 14}>
              {point.band === "unavailable" ? "ไม่มีค่า" : formatThaiNumber(point.month.riskSubdistricts)}
            </text>
            <text className="nr-forecast-axis-date" x={point.x} y={height - 28}>
              <tspan x={point.x}>T+{point.month.monthIndex}</tspan>
              <tspan x={point.x} dy="16">{compactChart ? point.month.labelTh.replace(/\d{2}(\d{2})$/, "$1") : point.month.labelTh}</tspan>
            </text>
          </g>
        ))}
        <text className="nr-forecast-axis-unit" x={padding.left - 8} y={padding.top - 10}>ตำบล</text>
      </svg>
      <figcaption className="nr-forecast-line-legend nr-drought-forecast-legend">
        <span><i className="is-normal" />ไม่พบความเสี่ยงในตำบลที่มีค่า</span>
        <span><i className="is-watch" />เสี่ยงน้อยกว่าครึ่งจำนวนตำบล</span>
        <span><i className="is-severe" />เสี่ยงตั้งแต่ครึ่งจำนวนตำบล</span>
        <span className="nr-drought-forecast-threshold-label"><i className="is-threshold" />
          {singleSubdistrict ? "เส้นอ้างอิงเมื่อพบความเสี่ยง" : `เส้นอ้างอิงครึ่งจำนวนตำบล (${formatThaiNumber(threshold)} ตำบลขึ้นไป)`}
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
    ? "เลือกเดือนตั้งต้นและระยะพยากรณ์ T+ โดยแสดงเฉพาะข้อมูลของตำบลนี้"
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
            สีแผนที่มาจากคำพยากรณ์รายตำบลของเดือนที่พยากรณ์ และแยกพื้นที่นอกขอบเขตการศึกษาออกจากพื้นที่ไม่มีความเสี่ยง
          </p>
        </div>
        <aside className="nr-forecast-archive-target" aria-label="บริบทเดือนที่พยากรณ์บนแผนที่">
          <span>เดือนที่พยากรณ์บนแผนที่</span>
          <strong>{formatMonth(summary.targetMonth, "th")}</strong>
          <small>
            T+{selectedHorizon} · เดือนตั้งต้น {issueMonthLabel}
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
      detail: `ล่วงหน้า ${selectedHorizon} เดือน (T+${selectedHorizon})`,
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
      provenance: selectedRecord ? "REAL" : "PENDING_SOURCE",
    }]} />;
  }
  const kpis: (SummaryMetric & { id: string })[] = [
    {
      id: "coverage",
      label: "มีค่าพยากรณ์",
      value: `${formatThaiNumber(summary.inScopeSubdistricts)}/${formatThaiNumber(summary.totalSubdistricts)} ตำบล`,
      detail: `${formatPercent(summary.totalSubdistricts ? summary.inScopeSubdistricts / summary.totalSubdistricts * 100 : 0)} ของจำนวนตำบลทั้งหมด`,
      icon: <Database size={17} />,
      tone: "info",
      provenance: "REAL" as DataProvenanceChipKind,
    },
    {
      id: "no-risk",
      label: "ไม่มีความเสี่ยง",
      value: `${formatThaiNumber(summary.noRiskSubdistricts)} ตำบล`,
      detail: summary.inScopeSubdistricts > 0 ? "ผลพยากรณ์: ไม่พบสัญญาณเสี่ยง" : "ไม่มีค่าพยากรณ์ให้ประเมิน",
      icon: <ShieldAlert size={17} />,
      tone: summary.inScopeSubdistricts > 0 ? "good" : "muted",
      provenance: summary.inScopeSubdistricts > 0 ? "REAL" : "PENDING_SOURCE",
    },
    {
      id: "moderate",
      label: "เสี่ยงปานกลาง",
      value: `${formatThaiNumber(summary.moderateRiskSubdistricts)} ตำบล`,
      detail: summary.inScopeSubdistricts > 0 ? "ผลพยากรณ์: เสี่ยงปานกลาง" : "ไม่มีค่าพยากรณ์ให้ประเมิน",
      icon: <TrendingUp size={17} />,
      tone: summary.inScopeSubdistricts > 0 ? "watch" : "muted",
      provenance: summary.inScopeSubdistricts > 0 ? "REAL" : "PENDING_SOURCE",
    },
    {
      id: "high",
      label: "เสี่ยงสูง",
      value: `${formatThaiNumber(summary.highRiskSubdistricts)} ตำบล`,
      detail: summary.inScopeSubdistricts > 0 ? "ผลพยากรณ์: เสี่ยงสูง" : "ไม่มีค่าพยากรณ์ให้ประเมิน",
      icon: <AlertTriangle size={17} />,
      tone: summary.inScopeSubdistricts > 0 ? "danger" : "muted",
      provenance: summary.inScopeSubdistricts > 0 ? "REAL" : "PENDING_SOURCE",
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
  trendMonths,
  selectedHorizon,
  singleSubdistrict = false,
  scopeLabel,
  coverageRemark,
}: {
  trendMonths: DroughtForecastTrendMonth[];
  selectedHorizon: ForecastArchiveHorizon;
  singleSubdistrict?: boolean;
  scopeLabel: string;
  coverageRemark: string;
}) {
  const activeForecastMonth = trendMonths[selectedHorizon - 1] ?? trendMonths[0];
  const totalSubdistricts = Math.max(...trendMonths.map((month) => month.totalSubdistricts), 1);
  const forecastHasData = trendMonths.some((month) => month.inScopeSubdistricts > 0);

  return (
    <section className="nr-drought-workspace-chart-card" aria-labelledby="nr-drought-workspace-chart-title">
      <div className="nr-drought-workspace-card-heading">
        <div>
          <p className="eyebrow">พยากรณ์ 6 เดือนข้างหน้า</p>
          <h3 id="nr-drought-workspace-chart-title">จำนวนตำบลเสี่ยงในแต่ละเดือน</h3>
          <span>
            {activeForecastMonth
              ? `เน้น T+${selectedHorizon} · ${activeForecastMonth.labelTh} · ${scopeLabel}`
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
        <div className="nr-forecast-unavailable" role="status">
          <Info size={24} aria-hidden="true" />
          <strong>ไม่มีค่าพยากรณ์ให้เปรียบเทียบ</strong>
          <span>ตำบลนอกขอบเขตหรือไม่มีข้อมูล ไม่สามารถสรุปว่าไม่มีความเสี่ยง</span>
        </div>
      )}
      <p className="nr-compact-note">
        {coverageRemark}
      </p>
    </section>
  );
}

export function DroughtForecastWorkspaceMapCard({
  irrigation,
  filteredSubdistrictCodes,
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
  irrigation?: ForecastMapIrrigation;
  filteredSubdistrictCodes?: string[];
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
          <h3>{readinessMap ? "แผนที่ความพร้อมข้อมูลพื้นที่" : irrigation?.colorMode === "irrigation" ? "แผนที่สถานะชลประทาน" : `${title} (T+${forecastArchiveHorizon})`}</h3>
          <span>
            เดือนที่พยากรณ์ {formatMonth(forecastArchiveTargetMonthForSelection(forecastArchiveMonth, forecastArchiveHorizon), "th")} · T+{forecastArchiveHorizon} จากเดือนตั้งต้น {issueMonthLabel}
          </span>
        </div>
        <DataProvenanceChip kind="REAL" />
      </div>
      {readinessMap && <button type="button" className="secondary-button nr-return-forecast" onClick={onCloseReadinessMap}>กลับแผนที่พยากรณ์</button>}
      <NakhonRatchasimaLocalMap
        irrigation={irrigation}
        filteredSubdistrictCodes={filteredSubdistrictCodes}
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
  irrigation,
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
  irrigation: ForecastMapIrrigation;
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

  const matchingCodes = forecastSubdistrictCodesForIrrigation(archive, irrigation.value, expectedSubdistrictCodes);
  const summary = forecastArchiveSummaryForSelection(archive, selectedTargetMonth, selectedHorizon, matchingCodes);
  const trendMonths = forecastArchiveTrendMonthsForSelection(archive, selectedTargetMonth, matchingCodes);
  const emptyIrrigationScope = matchingCodes.length === 0;
  const forecastCoverageRemark = `T+${selectedHorizon}: มีค่าพยากรณ์ ${formatThaiNumber(summary.inScopeSubdistricts)}/${formatThaiNumber(summary.totalSubdistricts)} ตำบล · นอกขอบเขต ${formatThaiNumber(summary.outOfScopeSubdistricts)} · ไม่มีข้อมูล ${formatThaiNumber(summary.missingSubdistricts)} ตำบล`;
  const selectedRecord =
    level === "subdistrict" && expectedSubdistrictCodes?.[0]
      ? summary.recordsBySubdistrict.get(expectedSubdistrictCodes[0])
      : undefined;

  const navigateWithForecast = (path: string) => onNavigate(pathWithForecastSelection(path, selectedTargetMonth.period, selectedHorizon, irrigation.value));
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
    <section className={`nr-drought-compact-workspace is-${level}${emptyIrrigationScope ? " is-empty-scope" : ""}`} aria-labelledby={`nr-drought-compact-workspace-${level}`}>
      <div className="nr-drought-workspace-head">
        <div>
          <p className="eyebrow">ข้อมูลพยากรณ์</p>
          <h2 id={`nr-drought-compact-workspace-${level}`}>{title}</h2>
          <p>{description}</p>
        </div>
        <DataProvenanceChip kind="REAL" />
      </div>
      <p className="nr-forecast-target-note">เดือนตั้งต้น {selectedTargetMonth.labelTh} · พยากรณ์ล่วงหน้า 1–6 เดือน: {trendMonths[0]?.labelTh} – {trendMonths.at(-1)?.labelTh}</p>

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

        {emptyIrrigationScope ? <div className="nr-drought-workspace-kpis nr-irrigation-empty" role="status">
          <p>ไม่พบตำบลที่ตรงกับสถานะชลประทานในพื้นที่นี้</p>
          <button type="button" className="secondary-button" onClick={() => irrigation.onChange("all")}>แสดงทุกสถานะชลประทาน</button>
        </div> : <DroughtForecastWorkspaceKpiStrip level={level} summary={summary} selectedRecord={selectedRecord} />}

        <div className="nr-drought-workspace-main">
          {level !== "subdistrict" && !emptyIrrigationScope && (
            <DroughtForecastWorkspaceChart
              trendMonths={trendMonths}
              selectedHorizon={selectedHorizon}
              singleSubdistrict={singleSubdistrict}
              scopeLabel={scopeLabel}
              coverageRemark={forecastCoverageRemark}
            />
          )}
          <DroughtForecastWorkspaceMapCard
            irrigation={{ ...irrigation, onChange: (value) => { onCloseReadinessMap?.(); irrigation.onChange(value); } }}
            filteredSubdistrictCodes={irrigation.value === "all" ? undefined : matchingCodes}
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

      </div>
    </section>
    <div className="nr-operational-forecast-actions">
      {level !== "subdistrict" && !emptyIrrigationScope && <DroughtOperationalSummary
        horizon={selectedHorizon} riskSubdistricts={summary.riskSubdistricts} inScopeSubdistricts={summary.inScopeSubdistricts}
      />}
      {level !== "subdistrict" && attentionRecords.length > 0 && <DroughtOperationalDisclosure title="ตำบลภัยแล้งที่ควรตรวจสอบ" icon="map"
        description={`เสี่ยงสูง ${formatThaiNumber(summary.highRiskSubdistricts)} · ปานกลาง ${formatThaiNumber(summary.moderateRiskSubdistricts)} ตำบล`}>
        <ul className="nr-operational-attention-list">{attentionRecords.map((record) => <li key={record.subdistrictCode}>
          <button type="button" onClick={() => { const path = pathForSubdistrictCode(record.subdistrictCode); if (path) navigateWithForecast(path); }}>
            <span>ต.{record.subdistrictNameTh} · อ.{record.districtNameTh}</span><strong>{record.riskLabelTh}</strong>
          </button>
        </li>)}</ul>
        <p>เรียงตามระดับพยากรณ์ แล้วตามรหัสตำบล ไม่ใช่การจัดอันดับความเสียหาย</p>
      </DroughtOperationalDisclosure>}
      <DroughtOperationalDisclosure className="nr-operational-guidance" title="คำแนะนำและข้อควรระวัง" description="ตรวจสอบข้อมูลพื้นที่ก่อนตัดสินใจ">
        <ul><li>ตรวจสอบพื้นที่ที่มีสัญญาณเสี่ยงกับข้อมูลภาคสนาม</li><li>เทียบพยากรณ์กับข้อมูลย้อนหลังและความพร้อมข้อมูล</li><li>ประสานหน่วยงานในพื้นที่ก่อนวางแผนจัดการน้ำ</li></ul>
        <p>T+1 ถึง T+6 คือพยากรณ์ล่วงหน้า 1 ถึง 6 เดือนจากเดือนตั้งต้นที่เลือก แม้เลือกเดือนตั้งต้นในอดีต เดือนที่พยากรณ์ก็ยังเดินไปข้างหน้า ไม่ใช่การยืนยันความเสียหายทางการ</p>
        <p>สีกราฟสรุปสัดส่วนจำนวนตำบล ไม่ใช่ระดับความรุนแรงรายตำบลหรือสัดส่วนเนื้อที่ เส้นครึ่งจำนวนตำบลเป็นเพียงเส้นอ้างอิง ไม่ใช่เกณฑ์เตือนภัยทางการ</p>
        <p>เดือนตั้งต้น (T) คือเดือนของข้อมูลต้นทาง เดือนที่พยากรณ์คำนวณโดยบวกระยะ T+ ข้อมูลนี้ระบุเป็นรายเดือน ไม่ได้ระบุวันออกพยากรณ์</p>
      </DroughtOperationalDisclosure>
    </div>
    </>
  );
}
