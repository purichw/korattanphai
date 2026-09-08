import {
  type NakhonRatchasimaResearchPanelSummary,
  type NakhonRatchasimaResearchSubdistrictLatest,
  type NakhonRatchasimaDistrict,
  type NakhonRatchasimaSubdistrict,
  type NakhonRatchasimaMapLayer,
  type NakhonRatchasimaDroughtForecastArchive,
  type NakhonRatchasimaDroughtForecastArchiveTargetMonth,
  type NakhonRatchasimaEvidenceRecord,
  type ProvinceMonthRisk,
} from "../../types";
import { DataProvenanceChip, DataProvenanceLegend, dataProvenanceChipKindFromText, type DataProvenanceChipKind } from "../DataProvenanceChip";
import {
  researchDisplayPeriod,
  researchLatestPeriod,
  formatThaiNumber,
  districtResearchRiskStatus,
  researchDistrictPath,
  coverageLabel,
  researchSubdistrictPath,
  researchJoinPolicyNote,
  type ActiveResearchPeriod,
  type ResearchAreaStats,
  localResearchPeriodLabel,
  formatPercent,
  researchAreaDroughtLabel,
  researchAreaDroughtTone,
  localResearchPeriodDetail,
  type LocalMapMode,
  localResearchRecordForSubdistrict,
  localMapStatusForResearchRecord,
  type LocalResearchRecord,
  localResearchPendingLabel,
  primaryHazardLabelTh,
  primaryCropLabelTh,
  type ProvinceDashboardTab,
  localResearchPeriodForSelectedMonth,
  type AgriculturalVisibilityFact,
  predictionReadinessSummary,
  type PredictionReadinessSummary,
  clamp,
  provinceDashboardTabLabel,
  translateClassification,
  translateAccess,
  translateStatus,
  translateLayerNoData,
  sourceAgencyFor,
  evidenceTitle,
  translateScope,
  translateFactValue,
  translateSpatialGranularity,
  translateSourceLimitation,
} from "./workspaceModel";
import {
  DashboardSection,
  DashboardDetailPanel,
  ResearchStatGrid,
  PanelTitle,
  DataGovernanceGuardrailList,
  EmptyLocalEvidence,
  OfficialMetricCard,
} from "./SharedPanels";
import { MetricCard, MetricGrid } from "../PageSummary";
import type { ForecastMapIrrigation } from "../IrrigationStatusSelect";
import {
  MapPin,
  Database,
  AlertTriangle,
  ShieldAlert,
  Leaf,
  Gauge,
  Info,
  TrendingUp,
  Map as MapIcon,
} from "lucide-react";
import { type ReactNode, type CSSProperties } from "react";
import {
  type NakhonRatchasimaRouteTarget,
  getNakhonRatchasimaPath,
  formatRai,
  getNakhonRatchasimaResearchPanelSummary,
  NAKHON_RATCHASIMA_ROUTE_BASE,
  getNakhonRatchasimaEvidenceForLocation,
  getNakhonRatchasimaSourceRows,
} from "../../domain";
import { type AppSelectOption } from "../AppSelect";
import { type ForecastArchiveHorizon, forecastArchiveIssueMonthForSelection, forecastArchiveTargetMonthForSelection } from "./forecastModel";
import { formatMonth, severityLabel, labelConfidence } from "../../i18n";
import { forecastHorizonLabel } from "../../forecastPeriod";
import { NakhonRatchasimaLocalMap } from "./NakhonRatchasimaLocalMap";
import forecastArchiveOverview from "../../data/generated/forecast-archive-summary.json";
import { type AuditTrailSection, AuditTrailFootnotes } from "../AuditTrail";

export function ProvinceDashboardHeading({ research }: { research: NakhonRatchasimaResearchPanelSummary }) {
  return (
    <section className="nr-dashboard-heading" aria-label="หัวข้อแดชบอร์ดจังหวัดนครราชสีมา">
      <div>
        <p className="eyebrow">ศูนย์ปฏิบัติการจังหวัด</p>
        <h2>จังหวัดนครราชสีมา</h2>
        <p>แดชบอร์ดสถานการณ์เกษตรและภัยแล้ง โดยแยกจังหวัด 32 อำเภอ 289 ตำบล และใช้รหัสพื้นที่เป็นแกนเชื่อมข้อมูล</p>
      </div>
      <div className="nr-dashboard-update">
        <div className="nr-dashboard-update-label">
          <span>แหล่งข้อมูลหลัก</span>
          <DataProvenanceChip kind="REAL" />
        </div>
        <strong>แหล่งข้อมูลหลัก: ข้อมูลสถานการณ์เกษตรและภัยแล้งที่จัดมาตรฐานแล้ว</strong>
        <small>
          {researchDisplayPeriod(research)} · รอบข้อมูลล่าสุด {researchLatestPeriod(research)}
        </small>
      </div>
      <DataProvenanceLegend
        className="nr-dashboard-provenance-legend"
        kinds={["REAL", "DERIVED", "PROXY", "PENDING_SOURCE"]}
      />
    </section>
  );
}

export function ResearchDroughtSituationPanel({ research }: { research: NakhonRatchasimaResearchPanelSummary }) {
  const hasData = research.meta.normalizedRowCount > 0;
  return (
    <DashboardSection
      eyebrow="ข้อมูลภัยแล้ง"
      title="สถานการณ์ภัยแล้งตามข้อมูลพื้นที่"
      description="ใช้สถานะภัยแล้งที่จัดมาตรฐานแล้วเป็นแกนหลัก เพื่อแยกพื้นที่เฝ้าระวังออกจากพื้นที่ปกติในเดือนล่าสุด"
      provenance={hasData ? "DERIVED" : "PENDING_SOURCE"}
      className="nr-drought-situation-section"
    >
      {hasData ? <ResearchStatGrid>
        <MetricCard label="เฝ้าระวังเดือนล่าสุด" value={`${formatThaiNumber(research.latest.droughtWatchSubdistricts)} ตำบล`} provenance="DERIVED" tone="watch" />
        <MetricCard label="ปกติเดือนล่าสุด" value={`${formatThaiNumber(research.latest.droughtNormalSubdistricts)} ตำบล`} provenance="DERIVED" tone="good" />
      </ResearchStatGrid> : <EmptyLocalEvidence />}
    </DashboardSection>
  );
}

export function ResearchDroughtDistrictPanel({
  research,
  onNavigate,
}: {
  research: NakhonRatchasimaResearchPanelSummary;
  onNavigate: (path: string) => void;
}) {
  const districts = [...research.districtsLatest]
    .sort(
      (a, b) =>
        b.droughtSevereSubdistricts - a.droughtSevereSubdistricts ||
        b.droughtWatchSubdistricts - a.droughtWatchSubdistricts ||
        b.droughtConflictKeys - a.droughtConflictKeys,
    )
    .slice(0, 6);

  return (
    <DashboardSection
      eyebrow="พื้นที่ติดตาม"
      title="พื้นที่ที่ควรติดตาม"
      description="จัดอันดับเพื่อชี้พื้นที่ที่ควรตรวจสอบต่อ ไม่ใช่การประกาศภัยรายอำเภอ"
      provenance="DERIVED"
      className="nr-follow-up-section"
    >
      {districts.length === 0 && <EmptyLocalEvidence />}
      <div className="nr-research-list">
        {districts.map((record) => {
          const status = districtResearchRiskStatus(record);
          const riskCount = record.droughtSevereSubdistricts + record.droughtWatchSubdistricts;
          return (
            <button key={record.districtCode} type="button" onClick={() => onNavigate(researchDistrictPath(record))}>
              <span>อ.{record.districtNameTh}</span>
              <b>{coverageLabel(status, "prediction-readiness")} · {formatThaiNumber(riskCount)} ตำบลเสี่ยง</b>
            </button>
          );
        })}
      </div>
    </DashboardSection>
  );
}

export function ResearchSubdistrictAttentionPanel({
  title,
  records,
  onNavigate,
}: {
  title: string;
  records: NakhonRatchasimaResearchSubdistrictLatest[];
  onNavigate: (path: string) => void;
}) {
  return (
    <section className="nr-panel nr-research-attention">
      <div className="nr-module-title-row">
        <PanelTitle icon={<MapPin size={18} />} title={title} />
        <DataProvenanceChip kind="DERIVED" />
      </div>
      <div className="nr-research-list">
        {records.slice(0, 5).map((record) => (
          <button key={record.subdistrictCode} type="button" onClick={() => onNavigate(researchSubdistrictPath(record))}>
            <span>ต.{record.subdistrictNameTh} · อ.{record.districtNameTh}</span>
            <b>{record.droughtRiskLabelTh}</b>
          </button>
        ))}
      </div>
      {records.length === 0 && <EmptyLocalEvidence />}
      <p className="provenance-note">เปิดพื้นที่เพื่อดูลำดับชั้นพื้นที่ จังหวัดนครราชสีมา → อำเภอ → ตำบล</p>
    </section>
  );
}

export function DataTransparencyPanel({
  sourceSummary,
  limitationsSummary = "สิ่งที่ควรรู้ก่อนนำข้อมูลไปใช้",
  sourceChildren,
  limitationsChildren,
  className = "",
}: {
  sourceSummary: ReactNode;
  limitationsSummary?: ReactNode;
  sourceChildren: ReactNode;
  limitationsChildren: ReactNode;
  className?: string;
}) {
  return (
    <section className={["nr-panel nr-data-transparency", className].filter(Boolean).join(" ")} aria-label="เกี่ยวกับข้อมูล">
      <div className="nr-data-transparency-heading">
        <p className="eyebrow">เกี่ยวกับข้อมูล</p>
      </div>
      <div className="nr-data-transparency-rows">
        <details className="nr-data-transparency-row is-sources">
          <summary>
            <span className="panel-icon" aria-hidden="true">
              <Database size={18} />
            </span>
            <span>
              <strong>แหล่งข้อมูลและความสด</strong>
              <small>{sourceSummary}</small>
            </span>
            <span className="nr-source-summary-action" aria-hidden="true" />
          </summary>
          <div className="nr-data-transparency-body">{sourceChildren}</div>
        </details>
        <details className="nr-data-transparency-row is-limitations">
          <summary>
            <span className="panel-icon" aria-hidden="true">
              <AlertTriangle size={18} />
            </span>
            <span>
              <strong>ข้อจำกัดสำคัญ</strong>
              <small>{limitationsSummary}</small>
            </span>
            <span className="nr-source-summary-action" aria-hidden="true" />
          </summary>
          <div className="nr-data-transparency-body">{limitationsChildren}</div>
        </details>
      </div>
    </section>
  );
}

export function ResearchSourceLimitsPanel({ research }: { research: NakhonRatchasimaResearchPanelSummary }) {
  return (
    <DataTransparencyPanel
      className="nr-research-source-section"
      sourceSummary="แหล่งข้อมูลหลักและรอบข้อมูลล่าสุดของหน้าภัยแล้ง"
      limitationsSummary="ข้อควรระวังก่อนใช้ข้อมูลเพื่อคาดการณ์หรือตัดสินใจ"
      sourceChildren={
        <>
          <dl className="nr-research-source-grid">
            <div>
              <dt>ขอบเขตข้อมูล</dt>
              <dd>ข้อมูลสถานการณ์และภัยแล้งที่จัดมาตรฐานแล้ว</dd>
            </div>
            <div>
              <dt>ข้อมูลพยากรณ์</dt>
              <dd>พยากรณ์ภัยแล้งล่วงหน้า 1 ถึง 6 เดือนจากเดือนตั้งต้นที่เลือก</dd>
            </div>
            <div>
              <dt>ข้อมูลรายเดือน</dt>
              <dd>ตารางสถานการณ์ภัยแล้งรายพื้นที่</dd>
            </div>
            <div>
              <dt>ขอบเขตการใช้</dt>
              <dd>ใช้เฉพาะสถานะภัยแล้ง ความพร้อมข้อมูลพื้นที่ และกฎเชื่อมรหัสพื้นที่</dd>
            </div>
          </dl>
          <p className="nr-compact-note">{researchJoinPolicyNote()} · ข้อมูลพยากรณ์ภัยแล้งแยกจากรายการย้อนหลังที่จัดมาตรฐานแล้ว</p>
        </>
      }
      limitationsChildren={
        <>
          <p className="nr-compact-note">{research.meta.conflictPolicyTh}</p>
          <div className="nr-research-source-guardrails">
            <DataGovernanceGuardrailList />
          </div>
        </>
      }
    />
  );
}

export function ResearchAreaHeading({
  district,
  subdistrict,
  activePeriod,
  stats,
}: {
  district: NakhonRatchasimaDistrict;
  subdistrict?: NakhonRatchasimaSubdistrict;
  activePeriod: ActiveResearchPeriod;
  stats: ResearchAreaStats;
}) {
  const isSubdistrict = subdistrict !== undefined;
  const areaLabel = isSubdistrict ? `รหัสตำบล: ${subdistrict.subdistrictCode}` : `รหัสอำเภอ: ${district.districtCode}`;
  const title = subdistrict?.nameTh ?? district.nameTh;
  const locationLine = subdistrict
    ? `จังหวัดนครราชสีมา → อำเภอ${district.nameTh} → ตำบล${subdistrict.nameTh}`
    : `จังหวัดนครราชสีมา → อำเภอ${district.nameTh} → ${formatThaiNumber(stats.totalSubdistricts)} ตำบล`;
  const coveragePercent = stats.totalSubdistricts > 0 ? (stats.recordCount / stats.totalSubdistricts) * 100 : 0;

  return (
    <section className="nr-dashboard-heading nr-area-heading" aria-label={`หัวข้อแดชบอร์ด${isSubdistrict ? "ระดับตำบล" : "ระดับอำเภอ"}`}>
      <div>
        <p className="eyebrow">{areaLabel}</p>
        <h2>{title}</h2>
        <p>{locationLine} ใช้ข้อมูลภัยแล้งรายเดือนที่จัดมาตรฐานแล้วเป็นแกนหลักสำหรับติดตามพื้นที่เกษตร</p>
      </div>
      <div className="summary-strip nr-area-heading-metrics">
        <MetricCard
          label="ข้อมูลรองรับ"
          value={isSubdistrict ? (stats.recordCount > 0 ? "มีข้อมูล" : "ไม่มีข้อมูล") : `${stats.recordCount}/${stats.totalSubdistricts} ตำบล`}
          detail={isSubdistrict ? `${localResearchPeriodLabel(activePeriod)}${activePeriod.isFallback ? " · ใช้เดือนล่าสุดแทน" : ""}` : `${formatPercent(coveragePercent, 0)} ของจำนวนตำบลทั้งหมด`}
          provenance={stats.recordCount > 0 ? "REAL" : "PENDING_SOURCE"}
        />
        <MetricCard
          label="สถานะภัยแล้ง"
          value={researchAreaDroughtLabel(stats)}
          detail={isSubdistrict ? "จากข้อมูลรายตำบล" : `${formatThaiNumber(stats.droughtWatchSubdistricts + stats.droughtSevereSubdistricts)} ตำบลเฝ้าระวัง`}
          provenance={stats.recordCount > 0 ? "DERIVED" : "PENDING_SOURCE"}
          tone={researchAreaDroughtTone(stats)}
        />
        <MetricCard
          label="ข้อมูลที่ต้องตรวจซ้ำ"
          value={stats.recordCount === 0 ? "ยังตรวจสอบไม่ได้" : isSubdistrict ? (stats.droughtConflictKeys > 0 ? "พบรายการ" : "ไม่พบ") : `${formatThaiNumber(stats.droughtConflictKeys)} ชุด`}
          detail="รอเจ้าหน้าที่ตรวจทาน"
          provenance={stats.recordCount === 0 ? "PENDING_SOURCE" : "DERIVED"}
          tone={stats.recordCount === 0 ? "muted" : stats.droughtConflictKeys > 0 ? "watch" : "good"}
        />
        <MetricCard
          label={isSubdistrict ? "ช่องว่างข้อมูล" : "ตำบลไม่มีข้อมูล"}
          value={isSubdistrict ? (stats.missingCount > 0 ? "ขาดข้อมูล" : "ครบ") : `${formatThaiNumber(stats.missingCount)} ตำบล`}
          detail={isSubdistrict ? "รายการรายเดือนของพื้นที่นี้" : `จากทั้งหมด ${formatThaiNumber(stats.totalSubdistricts)} ตำบล`}
          provenance={stats.missingCount > 0 ? "PENDING_SOURCE" : "REAL"}
          tone={stats.missingCount > 0 ? "watch" : "good"}
        />
      </div>
      <DataProvenanceLegend
        className="nr-dashboard-provenance-legend"
        kinds={["REAL", "DERIVED", "PENDING_SOURCE"]}
      />
    </section>
  );
}

export function ResearchAreaSituationPanel({
  district,
  subdistrict,
  stats,
  activePeriod,
}: {
  district: NakhonRatchasimaDistrict;
  subdistrict?: NakhonRatchasimaSubdistrict;
  stats: ResearchAreaStats;
  activePeriod: ActiveResearchPeriod;
}) {
  const isSubdistrict = Boolean(subdistrict);

  return (
    <DashboardSection
      eyebrow="ข้อมูลรายเดือน"
      title={isSubdistrict ? "สถานการณ์ตำบลตามข้อมูลพื้นที่" : "สถานการณ์อำเภอตามข้อมูลพื้นที่"}
      description={
        isSubdistrict
          ? "แสดงข้อมูลรายตำบลตรงจากตารางข้อมูลรายเดือน ถ้ารายการข้อมูลขาดจะไม่เดาค่าทดแทน"
          : "สรุปจากรายการรายตำบลในอำเภอนี้ ไม่ใช้ค่าประมาณหรือหลักฐานเก่าเป็นตัวเลขหลัก"
      }
      provenance={stats.recordCount > 0 ? "REAL" : "PENDING_SOURCE"}
      className="nr-area-situation-section"
    >
      <ResearchStatGrid>
        <MetricCard
          label="รอบข้อมูล"
          value={localResearchPeriodLabel(activePeriod)}
          detail={localResearchPeriodDetail(activePeriod)}
          provenance={activePeriod.hasData ? "REAL" : "PENDING_SOURCE"}
        />
        <MetricCard
          label="ข้อมูลรองรับ"
          value={isSubdistrict ? (stats.recordCount > 0 ? "มีข้อมูล" : "ไม่มีข้อมูล") : `${formatThaiNumber(stats.recordCount)}/${formatThaiNumber(stats.totalSubdistricts)} ตำบล`}
          provenance={stats.recordCount > 0 ? "REAL" : "PENDING_SOURCE"}
        />
        <MetricCard
          label="พื้นที่เฝ้าระวัง"
          value={isSubdistrict ? researchAreaDroughtLabel(stats) : `${formatThaiNumber(stats.droughtWatchSubdistricts + stats.droughtSevereSubdistricts)} ตำบล`}
          provenance={stats.recordCount > 0 ? "DERIVED" : "PENDING_SOURCE"}
          tone={researchAreaDroughtTone(stats)}
        />
        <MetricCard
          label="ข้อมูลที่ต้องตรวจซ้ำ"
          value={stats.recordCount === 0 ? "ยังตรวจสอบไม่ได้" : isSubdistrict ? (stats.droughtConflictKeys > 0 ? "พบรายการ" : "ไม่พบ") : `${formatThaiNumber(stats.droughtConflictKeys)} ชุด`}
          detail="รายการที่ต้องตรวจทานจากข้อมูลรายเดือน"
          provenance={stats.recordCount === 0 ? "PENDING_SOURCE" : "DERIVED"}
          tone={stats.recordCount === 0 ? "muted" : stats.droughtConflictKeys > 0 ? "watch" : "good"}
        />
      </ResearchStatGrid>
      <p className="nr-compact-note">{researchJoinPolicyNote()}</p>
    </DashboardSection>
  );
}

export function ResearchAreaMapSection({
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
}: {
  target: Extract<NakhonRatchasimaRouteTarget, { valid: true; level: "district" | "subdistrict" }>;
  layer: NakhonRatchasimaMapLayer;
  mapMode: LocalMapMode;
  onMapModeChange: (mode: LocalMapMode) => void;
  onNavigate: (path: string) => void;
  selectedMonth: string;
  monthOptions: AppSelectOption[];
  onMonthChange: (month: string) => void;
  forecastArchive?: NakhonRatchasimaDroughtForecastArchive;
  forecastArchiveMonth?: NakhonRatchasimaDroughtForecastArchiveTargetMonth | null;
  forecastArchiveHorizon?: ForecastArchiveHorizon;
  forecastArchiveIssueMonth?: string;
}) {
  const isSubdistrict = target.level === "subdistrict";
  const hasForecastArchive = Boolean(forecastArchiveMonth && forecastArchive);
  const title = hasForecastArchive
    ? isSubdistrict
      ? "แผนที่พยากรณ์ความเสี่ยงภัยแล้งของตำบล"
      : "แผนที่พยากรณ์ความเสี่ยงภัยแล้งระดับตำบล"
    : target.level === "district"
      ? "แผนที่ตำบลในอำเภอ"
      : "แผนที่ตำบล";
  const description =
    hasForecastArchive && forecastArchiveMonth
      ? `เดือนที่พยากรณ์ ${formatMonth(forecastArchiveTargetMonthForSelection(forecastArchiveMonth, forecastArchiveHorizon ?? 1), "th")} · ${forecastHorizonLabel(forecastArchiveHorizon ?? 1)} จากเดือนตั้งต้น ${formatMonth(forecastArchiveIssueMonth ?? forecastArchiveIssueMonthForSelection(forecastArchiveMonth, forecastArchiveHorizon ?? 1), "th")}`
      : isSubdistrict
        ? "แผนที่แสดงตำแหน่งและระดับความเสี่ยงของตำบลนี้ตามข้อมูลปัจจุบัน"
        : "ใช้ตัวกรองร่วมกันบนแผนที่: ข้อมูลรองรับและระดับความเสี่ยง สามารถกรองซ้อนกันแบบตรงทุกเงื่อนไขได้";
  return (
    <DashboardSection
      eyebrow="แผนที่"
      title={title}
      description={description}
      provenance="REAL"
      className="nr-area-map-section"
    >
      <NakhonRatchasimaLocalMap
        target={target}
        layer={layer}
        mapMode={mapMode}
        onMapModeChange={onMapModeChange}
        onNavigate={onNavigate}
        selectedMonth={selectedMonth}
        monthOptions={monthOptions}
        onMonthChange={onMonthChange}
        forecastArchive={forecastArchive}
        forecastArchiveMonth={forecastArchiveMonth}
        forecastArchiveHorizon={forecastArchiveHorizon}
        forecastArchiveIssueMonth={forecastArchiveIssueMonth}
      />
    </DashboardSection>
  );
}

export function ResearchAreaDroughtHistoryPanel({
  title,
  series,
  isSubdistrict = false,
}: {
  title: string;
  series: Array<{ period: string } & ResearchAreaStats>;
  isSubdistrict?: boolean;
}) {
  const hasData = series.some((point) => point.recordCount > 0);
  const maxRiskCount = Math.max(1, ...series.map((point) => point.droughtWatchSubdistricts + point.droughtSevereSubdistricts));

  return (
    <DashboardSection
      eyebrow="ภัยแล้งย้อนหลัง"
      title={title}
      description="สถานะภัยแล้งอ่านจากข้อมูลรายเดือนที่จัดมาตรฐานแล้ว และแยกรายการที่ต้องตรวจทานออกจากค่าหลัก"
      provenance={hasData ? "DERIVED" : "PENDING_SOURCE"}
      className="nr-area-chart-section"
    >
      {hasData ? (
        <>
          <div className="nr-area-drought-trend" aria-label={title}>
            {series.map((point) => {
              const riskCount = point.droughtWatchSubdistricts + point.droughtSevereSubdistricts;
              const statusClass =
                point.recordCount === 0
                  ? "is-missing"
                  : point.droughtSevereSubdistricts > 0
                    ? "is-severe"
                    : point.droughtWatchSubdistricts > 0
                      ? "is-watch"
                      : "is-normal";
              return (
                <span key={point.period} className={statusClass}>
                  <i style={{ height: `${Math.max(10, (riskCount / maxRiskCount) * 100)}%` }} />
                  <small>{formatMonth(point.period, "th").replace("25", "")}</small>
                  <b>{isSubdistrict ? researchAreaDroughtLabel(point) : `${formatThaiNumber(riskCount)}/${formatThaiNumber(point.totalSubdistricts)}`}</b>
                </span>
              );
            })}
          </div>
          <p className="nr-compact-note">สีของกราฟแยกปกติ เฝ้าระวัง และเสี่ยงสูงตามข้อมูลที่ resolve แล้ว</p>
        </>
      ) : (
        <EmptyLocalEvidence />
      )}
    </DashboardSection>
  );
}

export function ResearchAreaSubdistrictsPanel({
  district,
  period,
  onNavigate,
}: {
  district: NakhonRatchasimaDistrict;
  period: string;
  onNavigate: (path: string) => void;
}) {
  return (
    <DashboardSection
      id="district-subdistricts"
      eyebrow="ลำดับชั้นพื้นที่"
      title="ตำบลในอำเภอนี้"
      description="แสดงสถานะรายตำบลในอำเภอตามรอบข้อมูลเดียวกัน"
      provenance="REAL"
      className="nr-area-subdistrict-section"
    >
      <div className="nr-subdistrict-grid nr-area-subdistrict-grid">
        {district.subdistricts.map((subdistrict) => {
          const record = localResearchRecordForSubdistrict(subdistrict.subdistrictCode, period);
          const status = localMapStatusForResearchRecord(record, "risk");
          return (
            <button
              key={subdistrict.subdistrictCode}
              type="button"
              className={`nr-subdistrict-card is-${status}`}
              onClick={() => onNavigate(getNakhonRatchasimaPath(district, subdistrict))}
            >
              <strong>{subdistrict.nameTh}</strong>
              <span>{subdistrict.subdistrictCode}</span>
              <small>{record ? record.droughtRiskLabelTh : "ไม่มีข้อมูล"}</small>
            </button>
          );
        })}
      </div>
    </DashboardSection>
  );
}

export function ResearchAreaAttentionPanel({
  district,
  period,
  onNavigate,
}: {
  district: NakhonRatchasimaDistrict;
  period: string;
  onNavigate: (path: string) => void;
}) {
  const rows = district.subdistricts
    .map((subdistrict) => ({
      subdistrict,
      record: localResearchRecordForSubdistrict(subdistrict.subdistrictCode, period),
    }))
    .filter(({ record }) => record && record.droughtRiskLevel !== null && record.droughtRiskLevel > 0)
    .sort(
      (a, b) =>
        (b.record?.droughtRiskLevel ?? -1) - (a.record?.droughtRiskLevel ?? -1),
    )
    .slice(0, 5);

  if (rows.length === 0) return null;

  return (
    <DashboardSection
      eyebrow="พื้นที่ติดตาม"
      title="พื้นที่เฝ้าระวัง / ควรตรวจติดตาม"
      description="เรียงจากระดับภัยแล้งในเดือนที่เลือก"
      provenance="DERIVED"
      className="nr-area-side-section nr-area-watchlist-section"
    >
      <div className="nr-research-list">
        {rows.map(({ subdistrict, record }) => (
          <button key={subdistrict.subdistrictCode} type="button" onClick={() => onNavigate(getNakhonRatchasimaPath(district, subdistrict))}>
            <span>ต.{subdistrict.nameTh}</span>
            <b>{record ? record.droughtRiskLabelTh : "ไม่มีข้อมูล"}</b>
          </button>
        ))}
      </div>
      <a className="secondary-button nr-area-attention-all" href="#district-subdistricts">
        ดูทั้งหมด {formatThaiNumber(district.subdistricts.length)} ตำบล
      </a>
    </DashboardSection>
  );
}

export function ResearchSubdistrictProfilePanel({
  district,
  subdistrict,
  record,
}: {
  district: NakhonRatchasimaDistrict;
  subdistrict: NakhonRatchasimaSubdistrict;
  record: LocalResearchRecord;
}) {
  return (
    <DashboardSection
      eyebrow="พื้นที่"
      title="โปรไฟล์ตำบล"
      description="ข้อมูลอ้างอิงพื้นที่และรายการรายเดือนที่ตรวจสอบได้"
      provenance={record ? "REAL" : "PENDING_SOURCE"}
      className="nr-area-side-section"
    >
      <dl className="nr-compact-list">
        <div>
          <dt>จังหวัด</dt>
          <dd>นครราชสีมา</dd>
        </div>
        <div>
          <dt>อำเภอ</dt>
          <dd>{district.nameTh}</dd>
        </div>
        <div>
          <dt>ตำบล</dt>
          <dd>{subdistrict.nameTh}</dd>
        </div>
        <div>
          <dt>รหัสตำบล</dt>
          <dd>{subdistrict.subdistrictCode}</dd>
        </div>
      </dl>
    </DashboardSection>
  );
}

export function ResearchSubdistrictDataGapPanel({
  stats,
  activePeriod,
}: {
  stats: ResearchAreaStats;
  activePeriod: ActiveResearchPeriod;
}) {
  return (
    <DashboardSection
      eyebrow="ช่องว่างข้อมูล"
      title="ช่องว่างของตำบล"
      description="ตัวชี้วัดนี้สรุปรายการข้อมูลรายเดือนที่ยังไม่เชื่อมกับพื้นที่"
      provenance={stats.missingCount > 0 ? "PENDING_SOURCE" : "REAL"}
      className="nr-area-side-section nr-subdistrict-gap-section"
    >
      <ResearchStatGrid>
        <MetricCard
          label="รายการที่ยังไม่มี"
          value={`${formatThaiNumber(stats.missingCount)} รายการ`}
          detail={activePeriod.isCleared ? localResearchPendingLabel : activePeriod.isFallback ? "ใช้เดือนล่าสุดแทนเดือนที่เลือก" : localResearchPeriodLabel(activePeriod)}
          provenance={stats.missingCount > 0 ? "PENDING_SOURCE" : "REAL"}
          tone={stats.missingCount > 0 ? "watch" : "good"}
        />
        <MetricCard
          label="รายการต้องตรวจซ้ำ"
          value={stats.recordCount === 0 ? "ยังตรวจสอบไม่ได้" : stats.droughtConflictKeys > 0 ? "พบรายการ" : "ไม่พบ"}
          detail="อ่านจากข้อมูลรายเดือน"
          provenance={stats.recordCount === 0 ? "PENDING_SOURCE" : "DERIVED"}
          tone={stats.recordCount === 0 ? "muted" : stats.droughtConflictKeys > 0 ? "watch" : "good"}
        />
      </ResearchStatGrid>
    </DashboardSection>
  );
}

export function ResearchAreaSourceLimitsPanel({
  district,
  subdistrict,
  stats,
  directRecords,
  inheritedRecords,
}: {
  district: NakhonRatchasimaDistrict;
  subdistrict?: NakhonRatchasimaSubdistrict;
  stats: ResearchAreaStats;
  directRecords: NakhonRatchasimaEvidenceRecord[];
  inheritedRecords: NakhonRatchasimaEvidenceRecord[];
}) {
  const areaName = subdistrict ? `ตำบล${subdistrict.nameTh} อำเภอ${district.nameTh}` : `อำเภอ${district.nameTh}`;

  return (
    <DataTransparencyPanel
      className="nr-research-source-section nr-area-source-section"
      sourceSummary={`${areaName} · ${formatThaiNumber(stats.recordCount)}/${formatThaiNumber(stats.totalSubdistricts)} ตำบลมีข้อมูลในเดือนที่เลือก`}
      limitationsSummary="ข้อควรระวังของข้อมูลพื้นที่และการเชื่อมรหัส"
      sourceChildren={
        <>
          <dl className="nr-research-source-grid">
            <div>
              <dt>พื้นที่</dt>
              <dd>{areaName}</dd>
            </div>
            <div>
              <dt>ขอบเขตข้อมูล</dt>
              <dd>ข้อมูลสถานการณ์และภัยแล้งที่จัดมาตรฐานแล้ว</dd>
            </div>
            <div>
              <dt>ข้อมูลรายเดือนที่ใช้อยู่</dt>
              <dd>ตารางสถานการณ์ภัยแล้งรายพื้นที่</dd>
            </div>
            <div>
              <dt>ความครอบคลุมในเดือนที่เลือก</dt>
              <dd>
                {formatThaiNumber(stats.recordCount)}/{formatThaiNumber(stats.totalSubdistricts)} ตำบล
              </dd>
            </div>
            <div>
              <dt>ข้อมูลที่ต้องตรวจซ้ำ</dt>
              <dd>{stats.droughtConflictKeys > 0 ? `${formatThaiNumber(stats.droughtConflictKeys)} รายการต้องตรวจซ้ำ` : "ไม่พบรายการที่ต้องตรวจซ้ำในพื้นที่นี้"}</dd>
            </div>
            <div>
              <dt>หลักฐานประกอบอื่น</dt>
              <dd>
                ตรงพื้นที่ {formatThaiNumber(directRecords.length)} รายการ · สืบทอดจากระดับสูงกว่า {formatThaiNumber(inheritedRecords.length)} รายการ
              </dd>
            </div>
          </dl>
          <p className="nr-compact-note">{researchJoinPolicyNote()}</p>
        </>
      }
      limitationsChildren={
        <div className="nr-research-source-guardrails">
          <DataGovernanceGuardrailList />
        </div>
      }
    />
  );
}

export function ProvinceSituationCards({
  provinceRecord,
  compact = false,
}: {
  provinceRecord: ProvinceMonthRisk | undefined;
  compact?: boolean;
}) {
  const situationFacts = [
    {
      id: "hazard",
      icon: <ShieldAlert size={18} />,
      label: "ความเสี่ยงภัยแล้งเดือนนี้",
      value: provinceRecord ? severityLabel(provinceRecord.severity, "th") : "รอข้อมูล",
      detail: provinceRecord
        ? `${primaryHazardLabelTh} · ${primaryCropLabelTh} · ${formatMonth(provinceRecord.month, "th")}`
        : "ยังไม่มี record ของเดือนที่เลือก",
      tone: provinceRecord ? (provinceRecord.severity === "Normal" ? "good" : "default") : "muted",
      provenance: provinceRecord ? "DERIVED" : undefined,
    },
    {
      id: "crop",
      icon: <Leaf size={18} />,
      label: "พืชที่เกี่ยวข้อง",
      value: provinceRecord ? primaryCropLabelTh : "รอข้อมูล",
      detail: provinceRecord ? `ภัยหลัก: ${primaryHazardLabelTh}` : "ยังไม่มี record ของเดือนที่เลือก",
      tone: "default",
      provenance: provinceRecord ? dataProvenanceChipKindFromText(provinceRecord.provenance) : "PENDING_SOURCE",
    },
    {
      id: "exposed",
      icon: <Gauge size={18} />,
      label: "พื้นที่ในขอบเขตประเมิน",
      value: provinceRecord ? `${formatRai(provinceRecord.agriculturalAreaExposedRai)} ไร่` : "รอข้อมูล",
      detail: provinceRecord ? `พื้นที่เสี่ยงสูง ${formatRai(provinceRecord.highRiskAreaRai)} ไร่` : "ยังไม่คำนวณ",
      tone: provinceRecord && provinceRecord.highRiskAreaRai > 0 ? "watch" : "default",
      provenance: provinceRecord ? "DERIVED" : "PENDING_SOURCE",
    },
    {
      id: "confidence",
      icon: <Database size={18} />,
      label: "ความเชื่อมั่นของข้อมูล",
      value: provinceRecord ? labelConfidence(provinceRecord.confidence, "th") : "รอข้อมูล",
      detail: provinceRecord ? formatMonth(provinceRecord.month, "th") : "เลือกเดือนอื่นเพื่อดูข้อมูล",
      tone: "default",
      provenance: provinceRecord ? dataProvenanceChipKindFromText(provinceRecord.provenance) : "PENDING_SOURCE",
    },
  ] satisfies {
    id: string;
    icon: ReactNode;
    label: string;
    value: string;
    detail: string;
    tone: "default" | "watch" | "good" | "muted";
    provenance?: DataProvenanceChipKind;
  }[];

  return (
    <section className={compact ? "nr-dashboard-situation is-compact-rail" : "nr-dashboard-situation"} aria-label="ภาพรวมสถานการณ์วันนี้">
      <div className="nr-dashboard-section-heading">
        <div>
          <p className="eyebrow">ภาพรวมสถานการณ์วันนี้</p>
          <h2>ข้อมูลเกษตรที่เจ้าหน้าที่ควรรู้ก่อนเปิดพื้นที่</h2>
        </div>
        <span className="nr-inline-status">อ้างอิงข้อมูลเกษตรรอบล่าสุด</span>
      </div>
      {compact ? (
        <dl className="nr-dashboard-situation-list" aria-label="สรุปสถานการณ์วันนี้">
          {situationFacts.map((fact) => (
            <div key={fact.id} className={`is-${fact.tone}`}>
              <span className="nr-situation-list-icon" aria-hidden="true">
                {fact.icon}
              </span>
              <dt>{fact.label}</dt>
              <dd>
                <strong>{fact.value}</strong>
                <small>{fact.detail}</small>
              </dd>
              {fact.provenance ? <DataProvenanceChip kind={fact.provenance} /> : null}
            </div>
          ))}
        </dl>
      ) : (
        <div className="nr-dashboard-situation-cards">
          {situationFacts.map((fact) => (
            <OfficialMetricCard
              key={fact.id}
              icon={fact.icon}
              label={fact.label}
              value={fact.value}
              detail={fact.detail}
              tone={fact.tone}
              provenance={fact.provenance}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function ProvinceForecastArchiveEntryCard() {
  const { leadMonth, summary } = forecastArchiveOverview;
  const provinceForecastArchiveEntryHref = leadMonth
    ? `/drought?mapLayer=forecast-archive&target=${leadMonth.period}&horizon=1`
    : "/drought?mapLayer=forecast-archive&horizon=1";
  return (
    <section className="nr-forecast-archive-entry" aria-labelledby="nr-forecast-archive-entry-title">
      <span className="nr-forecast-archive-icon" aria-hidden="true">
        <Database size={21} />
      </span>
      <div className="nr-forecast-archive-copy">
        <p className="eyebrow">คลังพยากรณ์ย้อนหลัง</p>
        <h2 id="nr-forecast-archive-entry-title">ดูคำพยากรณ์ที่โมเดลเคยออกไว้</h2>
        <p>เลือกดูคำพยากรณ์ล่วงหน้า 1–6 เดือนที่จัดทำไว้ในอดีต โดยแยกจากสถานการณ์ภัยแล้งย้อนหลัง</p>
      </div>
      <dl className="nr-forecast-archive-meta" aria-label="สรุปคลังพยากรณ์ย้อนหลัง">
        <div>
          <dt>พื้นที่ครอบคลุม</dt>
          <dd>
            {summary
              ? `${formatThaiNumber(summary.inScopeSubdistricts)}/${formatThaiNumber(summary.totalSubdistricts)} ตำบล`
              : "รอข้อมูล"}
          </dd>
        </div>
        <div>
          <dt>เดือนตั้งต้น</dt>
          <dd>{leadMonth ? leadMonth.labelTh : "รอข้อมูล"}</dd>
        </div>
        <div>
          <dt>เสี่ยงล่วงหน้า 1 เดือน</dt>
          <dd>{summary ? `${formatThaiNumber(summary.riskSubdistricts)} ตำบล` : "รอข้อมูล"}</dd>
        </div>
      </dl>
      <a className="secondary-button nr-forecast-archive-link" href={provinceForecastArchiveEntryHref}>
        เปิดในหน้าภัยแล้ง →
      </a>
    </section>
  );
}

export function ProvinceDashboardMapCard({
  irrigation,
  filteredSubdistrictCodes,
  target,
  showMonthFilter,
  compactOverview = false,
  activeTab,
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
  target?: NakhonRatchasimaRouteTarget;
  showMonthFilter?: boolean;
  compactOverview?: boolean;
  activeTab: ProvinceDashboardTab;
  layer: NakhonRatchasimaMapLayer;
  mapMode: LocalMapMode;
  onMapModeChange: (mode: LocalMapMode) => void;
  onNavigate: (path: string) => void;
  selectedMonth: string;
  monthOptions: AppSelectOption[];
  onMonthChange: (month: string) => void;
  forecastArchive?: NakhonRatchasimaDroughtForecastArchive;
  forecastArchiveMonth?: NakhonRatchasimaDroughtForecastArchiveTargetMonth | null;
  forecastArchiveHorizon?: ForecastArchiveHorizon;
  forecastArchiveIssueMonth?: string;
  selectedSubdistrictCode: string | null;
  onSelectedSubdistrictChange: (subdistrictCode: string | null) => void;
}) {
  const research = getNakhonRatchasimaResearchPanelSummary();
  const activeResearchPeriod = localResearchPeriodForSelectedMonth(selectedMonth, research);
  const mapMonthLabel = localResearchPeriodLabel(activeResearchPeriod);
  const hasForecastArchive = Boolean(forecastArchiveMonth && forecastArchive);
  const title = hasForecastArchive && irrigation?.colorMode === "irrigation" ? "แผนที่สถานะชลประทาน" : hasForecastArchive ? "แผนที่พยากรณ์ความเสี่ยงภัยแล้ง" : "แผนที่สถานการณ์ภัยแล้ง";
  const helper =
    hasForecastArchive && forecastArchiveMonth
      ? `เดือนที่พยากรณ์ ${formatMonth(forecastArchiveTargetMonthForSelection(forecastArchiveMonth, forecastArchiveHorizon ?? 1), "th")} · ${forecastHorizonLabel(forecastArchiveHorizon ?? 1)} จากเดือนตั้งต้น ${formatMonth(forecastArchiveIssueMonth ?? forecastArchiveIssueMonthForSelection(forecastArchiveMonth, forecastArchiveHorizon ?? 1), "th")}`
      : activeTab === "drought"
      ? activeResearchPeriod.isCleared
        ? "ยังไม่มีชุดข้อมูลภัยแล้งรายตำบลสำหรับแผนที่ รอชุดข้อมูลใหม่"
        : `ข้อมูลภัยแล้ง · ${mapMonthLabel} · สีแสดงสถานะปกติ/เฝ้าระวัง/เสี่ยงสูง`
      : `${mapMonthLabel} · สีแสดงสถานะจากข้อมูลที่จัดมาตรฐานแล้ว ไม่ใช่ประกาศภัยทางการ${
          activeResearchPeriod.isFallback ? " · ไม่มีข้อมูลในเดือนที่เลือก จึงใช้เดือนล่าสุดแทน" : ""
        }`;

  return (
    <section className={`nr-dashboard-map-card is-${activeTab}-map`} aria-label={title}>
      <div className="nr-dashboard-map-header">
        <div>
          <p className="eyebrow">แผนที่</p>
          <h2>{title}</h2>
          <span>{helper}</span>
        </div>
      </div>
      <NakhonRatchasimaLocalMap
        irrigation={irrigation}
        filteredSubdistrictCodes={filteredSubdistrictCodes}
        target={target ?? { valid: true, level: "province", tab: activeTab }}
        showMonthFilter={showMonthFilter}
        compactForecast={compactOverview}
        overviewLayout={compactOverview}
        layer={layer}
        mapMode={mapMode}
        onMapModeChange={onMapModeChange}
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

export function AgricultureVisibilityPanel({
  facts,
  provenance,
  compact = false,
  context,
}: {
  facts: AgriculturalVisibilityFact[];
  provenance: DataProvenanceChipKind;
  compact?: boolean;
  context?: ReactNode;
}) {
  const metrics = <MetricGrid className="nr-agri-impact-summary" variant="segmented" ariaLabel="พื้นที่เกษตรที่นำมาประเมิน">
    {facts.map((fact) => <MetricCard key={fact.id} className="nr-agri-impact-cell" label={fact.label} value={fact.value} detail={fact.detail} icon={fact.icon} tone={fact.tone ?? "default"} />)}
  </MetricGrid>;
  if (compact) return <DashboardDetailPanel className="nr-home-agriculture" provenance={provenance} title="พื้นที่เกษตรที่นำมาประเมิน" icon={<Leaf size={20} />} preview={metrics}>
    {context}
    <p>พื้นที่ในขอบเขตประเมินและพื้นที่เสี่ยงสูงเป็นข้อมูลเกษตรระดับจังหวัด ไม่ใช่ตัวเลขเสียหายทางการ และไม่ใช่ผลรวมจากแผนที่พยากรณ์รายตำบล</p>
    <p>ยังไม่มีรายละเอียดไร่และความเชื่อมั่นรายอำเภอในชุดข้อมูลนี้</p>
  </DashboardDetailPanel>;
  return (
    <section className="nr-dashboard-module nr-agri-impact-module">
      <div className="nr-module-title-row">
        <PanelTitle icon={<Leaf size={18} />} title="พื้นที่เกษตรที่นำมาประเมิน" />
        <DataProvenanceChip kind={provenance} />
      </div>
      {metrics}
      <p className="nr-compact-note nr-agri-impact-disclaimer">
        <Info size={15} aria-hidden="true" />
        ไม่ใช่ตัวเลขเสียหายทางการ
      </p>
    </section>
  );
}

export function AgricultureImpactPanel({ provinceRecord, compact = false }: { provinceRecord: ProvinceMonthRisk | undefined; compact?: boolean }) {
  if (!provinceRecord || dataProvenanceChipKindFromText(provinceRecord.provenance) !== "REAL") return null;

  return (
    <AgricultureVisibilityPanel
      compact={compact}
      context={<p>ข้อมูลเกษตรระดับจังหวัด · {formatMonth(provinceRecord.month, "th")} · ความเชื่อมั่นของข้อมูล {labelConfidence(provinceRecord.confidence, "th")}</p>}
      provenance={dataProvenanceChipKindFromText(provinceRecord.provenance)}
      facts={[
        {
          id: "crop",
          label: "พืชหลัก",
          value: primaryCropLabelTh,
          icon: <Leaf size={18} />,
        },
        {
          id: "exposed-area",
          label: "พื้นที่ในขอบเขตประเมิน",
          value: `${formatRai(provinceRecord.agriculturalAreaExposedRai)} ไร่`,
          icon: <Gauge size={18} />,
        },
        {
          id: "high-risk-area",
          label: "พื้นที่เสี่ยงสูง",
          value: `${formatRai(provinceRecord.highRiskAreaRai)} ไร่`,
          tone: provinceRecord.highRiskAreaRai > 0 ? "danger" : "good",
          icon: <TrendingUp size={18} />,
        },
        {
          id: "confidence",
          label: "ความเชื่อมั่นของข้อมูล",
          value: labelConfidence(provinceRecord.confidence, "th"),
          tone: provinceRecord.confidence === "High" ? "good" : provinceRecord.confidence === "Medium" ? "watch" : "muted",
          icon: <ShieldAlert size={18} />,
        },
      ]}
    />
  );
}

export function ResearchAreaAgricultureImpactPanel({
  district,
  subdistrict,
  stats,
  activePeriod,
}: {
  district: NakhonRatchasimaDistrict;
  subdistrict?: NakhonRatchasimaSubdistrict;
  stats: ResearchAreaStats;
  activePeriod: ActiveResearchPeriod;
}) {
  if (!activePeriod.hasData || stats.recordCount === 0) return null;
  const isSubdistrict = Boolean(subdistrict);
  const riskSubdistricts = stats.droughtWatchSubdistricts + stats.droughtSevereSubdistricts;
  const dataCoverageValue = isSubdistrict
    ? stats.recordCount > 0
      ? "มีข้อมูล"
      : "ไม่มีข้อมูล"
    : `${formatThaiNumber(stats.recordCount)}/${formatThaiNumber(stats.totalSubdistricts)} ตำบล`;
  const dataCoverageTone = stats.recordCount === stats.totalSubdistricts ? "good" : stats.recordCount > 0 ? "watch" : "muted";
  const riskTone = riskSubdistricts > 0 ? "danger" : stats.recordCount > 0 ? "good" : "muted";

  return (
    <AgricultureVisibilityPanel
      provenance={stats.recordCount > 0 ? "REAL" : "PENDING_SOURCE"}
      facts={[
        {
          id: "crop",
          label: "พืชหลัก",
          value: primaryCropLabelTh,
          icon: <Leaf size={18} />,
        },
        {
          id: "visible-scope",
          label: "ขอบเขตการปกครอง",
          value: isSubdistrict ? "1 ตำบล" : `${formatThaiNumber(stats.totalSubdistricts)} ตำบล`,
          detail: isSubdistrict ? `อำเภอ${district.nameTh}` : `อำเภอ${district.nameTh}`,
          icon: <MapPin size={18} />,
        },
        {
          id: "drought-risk",
          label: isSubdistrict ? "สถานะภัยแล้ง" : "พื้นที่เฝ้าระวัง",
          value: isSubdistrict ? researchAreaDroughtLabel(stats) : `${formatThaiNumber(riskSubdistricts)} ตำบล`,
          detail: localResearchPeriodLabel(activePeriod),
          tone: riskTone,
          icon: <TrendingUp size={18} />,
        },
        {
          id: "data-coverage",
          label: "ความครบข้อมูล",
          value: dataCoverageValue,
          detail: activePeriod.isCleared ? localResearchPendingLabel : activePeriod.isFallback ? "ใช้เดือนล่าสุดแทน" : "รอบข้อมูลที่เลือก",
          tone: dataCoverageTone,
          icon: <ShieldAlert size={18} />,
        },
      ]}
    />
  );
}

export function PredictionReadinessPanel({
  month,
  onOpenMap,
  readiness = predictionReadinessSummary(),
  compact = false,
  scope = "aggregate",
}: {
  month?: string;
  onOpenMap: () => void;
  readiness?: PredictionReadinessSummary;
  compact?: boolean;
  scope?: "aggregate" | "single";
}) {
  const readyPercentLabel = formatPercent(readiness.readyPercent, 1);
  const clampedReadyPercent = clamp(readiness.readyPercent, 0, 100);
  const breakdownItems = [
    {
      id: "ready",
      label: "พร้อมระดับพื้นที่",
      count: readiness.readySubdistricts,
      tone: "good",
    },
    {
      id: "source",
      label: "มีข้อมูลตั้งต้น",
      count: readiness.sourceInputSubdistricts,
      tone: "info",
    },
    {
      id: "district",
      label: "มีบริบทระดับอำเภอ",
      count: readiness.districtContextSubdistricts,
      tone: "context",
    },
    {
      id: "blocked",
      label: "ข้อมูลยังไม่เพียงพอ",
      count: readiness.blockedSubdistricts,
      tone: "watch",
    },
  ];
  const sourceNote = "จากชุดหลักฐานพื้นที่และความพร้อมของแหล่งข้อมูลประกอบ ไม่ใช่ความครบถ้วนหรือความแม่นยำของคลังพยากรณ์ Excel";

  if (scope === "single") return <section className="nr-panel nr-prediction-readiness is-single" aria-label="ความพร้อมข้อมูลประกอบของตำบล">
    <MetricGrid ariaLabel="สถานะหลักฐานของตำบล" metrics={[{
      label: "หลักฐานประกอบของตำบล",
      value: breakdownItems.find((item) => item.count > 0)?.label ?? "ข้อมูลยังไม่เพียงพอ",
      detail: sourceNote,
      icon: <Database size={20} />,
      tone: "muted",
      provenance: "DERIVED",
    }]} />
    <button type="button" className="secondary-button nr-readiness-map-action" onClick={onOpenMap}><MapIcon size={18} aria-hidden="true" />ดูความพร้อมบนแผนที่</button>
  </section>;

  if (compact) return <DashboardDetailPanel className="nr-home-readiness" provenance="DERIVED" title="ความพร้อมข้อมูล" icon={<Gauge size={20} />} preview={
    <div className="nr-home-readiness-headline">
      <div className="nr-readiness-gauge" style={{ "--ready-progress": `${clampedReadyPercent}%` } as CSSProperties} aria-hidden="true"><strong>{formatThaiNumber(readiness.readySubdistricts)}</strong><span>จาก {formatThaiNumber(readiness.totalSubdistricts)}</span></div>
      <div><span>ข้อมูลพร้อมระดับพื้นที่</span><strong>{formatThaiNumber(readiness.readySubdistricts)} / {formatThaiNumber(readiness.totalSubdistricts)} ตำบล</strong><small>ความพร้อมข้อมูล ไม่ใช่ระดับภัย</small></div>
    </div>
  }>
    <dl className="nr-readiness-breakdown-list">{breakdownItems.map((item) => <div key={item.id} className={`is-${item.tone}`}><dt><i aria-hidden="true" />{item.label}</dt><dd>{formatThaiNumber(item.count)} ตำบล</dd></div>)}</dl>
    <p>พร้อมระดับพื้นที่ {readyPercentLabel} ของจำนวนตำบลทั้งหมด{month && ` · บริบทข้อมูล ${month}`}</p>
    <p>{sourceNote}</p>
    <button type="button" className="secondary-button nr-readiness-map-action" onClick={onOpenMap}><MapIcon size={18} aria-hidden="true" />ดูความพร้อมบนแผนที่</button>
  </DashboardDetailPanel>;

  return (
    <section className="nr-panel nr-prediction-readiness" aria-label="สถานะข้อมูลสำหรับคาดการณ์">
      <div className="nr-readiness-card-head">
        <div>
          <span className="panel-icon" aria-hidden="true">
            <Gauge size={18} />
          </span>
          <div>
            <h3>ความพร้อมข้อมูลประกอบ</h3>
            <p className="nr-readiness-lede">หลักฐานพื้นที่ ไม่ใช่ระดับภัยหรือความครบถ้วนของพยากรณ์</p>
          </div>
        </div>
        <DataProvenanceChip kind="DERIVED" />
      </div>
      <div className="nr-readiness-overview">
        <article className="nr-readiness-level-card" aria-label={`พร้อมระดับพื้นที่ ${formatThaiNumber(readiness.readySubdistricts)} จาก ${formatThaiNumber(readiness.totalSubdistricts)} ตำบล`}>
          <div
            className="nr-readiness-gauge"
            style={{ "--ready-progress": `${clampedReadyPercent}%` } as CSSProperties}
            aria-hidden="true"
          >
            <strong>{formatThaiNumber(readiness.readySubdistricts)}</strong>
            <span>จาก {formatThaiNumber(readiness.totalSubdistricts)}</span>
          </div>
          <div>
            <span>ข้อมูลพร้อมระดับพื้นที่</span>
            <strong>{formatThaiNumber(readiness.readySubdistricts)} ตำบล</strong>
            <small>
              {month && `รอบข้อมูล ${month} · `}{readyPercentLabel} ของจำนวนตำบลทั้งหมด
            </small>
            <div className="nr-readiness-progress" aria-label={`พร้อมคาดการณ์ระดับพื้นที่ ${readyPercentLabel}`}>
              <i style={{ width: `${clampedReadyPercent}%` }} />
            </div>
          </div>
        </article>
        <dl className="nr-readiness-breakdown-list">
          {breakdownItems.map((item) => (
            <div key={item.id} className={`is-${item.tone}`}>
              <dt>
                <i aria-hidden="true" />
                {item.label}
              </dt>
              <dd>{formatThaiNumber(item.count)} ตำบล</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="nr-readiness-footer">
        <p>{sourceNote}</p>
        <button type="button" className="secondary-button nr-readiness-map-action" onClick={onOpenMap}>
          <MapIcon size={18} aria-hidden="true" />
          ดูความพร้อมบนแผนที่
        </button>
      </div>
    </section>
  );
}

export function NakhonRatchasimaBreadcrumbs({
  target,
  onNavigate,
}: {
  target: NakhonRatchasimaRouteTarget;
  onNavigate: (path: string) => void;
}) {
  if (!target.valid) return null;
  const activeProvinceTabLabel =
    target.level === "province" && target.tab !== "overview" ? provinceDashboardTabLabel(target.tab) : null;
  return (
    <nav className="nr-breadcrumbs" aria-label="เส้นทางพื้นที่">
      <button type="button" onClick={() => onNavigate(NAKHON_RATCHASIMA_ROUTE_BASE)}>
        จังหวัดนครราชสีมา
      </button>
      {activeProvinceTabLabel && (
        <>
          <span>/</span>
          <strong>{activeProvinceTabLabel}</strong>
        </>
      )}
      {target.level !== "province" && (
        <>
          <span>/</span>
          <button type="button" onClick={() => onNavigate(getNakhonRatchasimaPath(target.district))}>
            {target.district.nameTh}
          </button>
        </>
      )}
      {target.level === "subdistrict" && (
        <>
          <span>/</span>
          <strong>{target.subdistrict.nameTh}</strong>
        </>
      )}
    </nav>
  );
}

export function NakhonRatchasimaLayerInspector({ layer }: { layer: NakhonRatchasimaMapLayer }) {
  return (
    <section className="nr-inspector">
      <div>
        <p className="eyebrow">{translateClassification(layer.classification)} · {translateAccess(layer.access)}</p>
        <h3>{layer.labelTh}</h3>
        <p>{translateStatus(layer.status)}</p>
      </div>
      <dl className="nr-compact-list">
        <div>
          <dt>การเชื่อมข้อมูล</dt>
          <dd>ใช้รหัสพื้นที่ ไม่ใช้ชื่อหรือที่อยู่เว็บ</dd>
        </div>
        <div>
          <dt>เมื่อไม่มีข้อมูล</dt>
          <dd>{translateLayerNoData(layer.noData)}</dd>
        </div>
      </dl>
    </section>
  );
}

export function SourceDecisionFootnotes() {
  const provinceEvidence = getNakhonRatchasimaEvidenceForLocation({}).direct.slice(0, 4);
  const sections: AuditTrailSection[] = [
    {
      id: "decision-evidence",
      title: "หลักฐานที่เกี่ยวข้องกับการตัดสินใจ",
      columns: 4,
      items: provinceEvidence.map((record) => ({
        id: record.id,
        provenance: record.provenance,
        eyebrow: sourceAgencyFor(record),
        title: evidenceTitle(record),
        body: translateScope(record.geography.scope),
      })),
    },
  ];

  return <AuditTrailFootnotes sections={sections} />;
}

export function SourceFreshness() {
  const sourceRows = getNakhonRatchasimaSourceRows().filter((row) =>
    [
      "SRC-GISTDA-ADMIN-BOUNDARY",
      "SRC-DOAE-FARMER-REGISTRATION",
      "SRC-DOAE-SOENGSANG-20260820",
      "SRC-OPSMOAC-NAKHON-RATCHASIMA-SITUATION",
    ].includes(row.source_id),
  );

  return (
    <DataTransparencyPanel
      className="nr-source-readiness"
      sourceSummary={`${formatThaiNumber(sourceRows.length)} แหล่งข้อมูลหลัก`}
      limitationsSummary="สิ่งที่ควรรู้ก่อนนำข้อมูลไปใช้"
      sourceChildren={
        <>
          <p className="provenance-note">
            ตารางนี้แสดงว่าแต่ละแหล่งใช้ทำอะไรและมีข้อจำกัดอะไร รายละเอียดเทคนิคยังเปิดดูได้ แต่ไม่ดันออกมาเป็นการ์ดยาวบนหน้าหลัก
          </p>
          <SourceDecisionFootnotes />
          <div className="nr-source-table-wrap">
            <table className="nr-source-table">
              <thead>
                <tr>
                  <th>ชุดข้อมูล</th>
                  <th>ใช้สำหรับ</th>
                  <th>สถานะ</th>
                  <th>รอบข้อมูล</th>
                  <th>ข้อจำกัด</th>
                </tr>
              </thead>
              <tbody>
                {sourceRows.map((row) => (
                  <tr key={row.source_id}>
                    <td className="nr-source-dataset-cell">
                      <DataProvenanceChip kind="REAL" />
                      <strong>{row.source_agency}</strong>
                      <span>{translateFactValue(row.dataset_system_name)}</span>
                    </td>
                    <td>{translateSpatialGranularity(row.spatial_granularity)}</td>
                    <td>
                      <span className="nr-inline-status">{translateAccess(row.access_classification)}</span>
                    </td>
                    <td>{translateFactValue(row.temporal_granularity || row.update_cadence || "ต้องตรวจสอบ")}</td>
                    <td>
                      <details>
                        <summary>{translateSourceLimitation(row.limitation)}</summary>
                        <dl className="nr-source-detail-list">
                          <div>
                            <dt>ชื่อชุดข้อมูล</dt>
                            <dd>{translateFactValue(row.dataset_system_name)}</dd>
                          </div>
                          <div>
                            <dt>วิธีเข้าถึง</dt>
                            <dd>{translateFactValue(row.access_method)}</dd>
                          </div>
                          <div>
                            <dt>กุญแจเชื่อมข้อมูล</dt>
                            <dd>{translateFactValue(row.geographic_join_keys)}</dd>
                          </div>
                          <div>
                            <dt>ลิงก์ต้นทาง</dt>
                            <dd>{row.source_url}</dd>
                          </div>
                        </dl>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      }
      limitationsChildren={
        <div className="nr-research-source-guardrails">
          <DataGovernanceGuardrailList />
        </div>
      }
    />
  );
}
