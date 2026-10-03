import {
  Gauge,
  Info,
  Leaf,
  ShieldAlert,
  TrendingUp
} from "lucide-react";
import { type ReactNode } from "react";
import {
  type NakhonRatchasimaRouteTarget,
  formatRai
} from "../../domain";
import { forecastHorizonLabel } from "../../forecastPeriod";
import { formatMonth, labelConfidence } from "../../i18n";
import {
  type NakhonRatchasimaDroughtForecastArchive,
  type NakhonRatchasimaDroughtForecastArchiveTargetMonth,
  type ProvinceMonthRisk
} from "../../types";
import { type AppSelectOption } from "../AppSelect";
import { type DataProvenanceChipKind, DataProvenanceChip, dataProvenanceChipKindFromText } from "../DataProvenanceChip";
import type { ForecastMapIrrigation } from "../IrrigationStatusSelect";
import { MetricCard, MetricGrid } from "../PageSummary";
import { type ForecastArchiveHorizon, forecastArchiveIssueMonthForSelection, forecastArchiveTargetMonthForSelection } from "./forecastModel";
import { NakhonRatchasimaLocalMap } from "./NakhonRatchasimaLocalMap";
import {
  DashboardDetailPanel,
  PanelTitle
} from "./SharedPanels";
import {
  type AgriculturalVisibilityFact,
  type ProvinceDashboardTab,
  primaryCropLabelTh
} from "./workspaceModel";

export function ProvinceDashboardMapCard({
  irrigation,
  filteredSubdistrictCodes,
  target,
  showMonthFilter,
  compactOverview = false,
  activeTab,
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
  const hasForecastArchive = Boolean(forecastArchiveMonth && forecastArchive);
  const title = hasForecastArchive && irrigation?.colorMode === "irrigation" ? "แผนที่สถานะชลประทาน" : hasForecastArchive ? "แผนที่พยากรณ์ความเสี่ยงภัยแล้ง" : "แผนที่สถานการณ์ภัยแล้ง";
  const helper =
    hasForecastArchive && forecastArchiveMonth
      ? `เดือนที่พยากรณ์ ${formatMonth(forecastArchiveTargetMonthForSelection(forecastArchiveMonth, forecastArchiveHorizon ?? 1), "th")} · ${forecastHorizonLabel(forecastArchiveHorizon ?? 1)} จากเดือนตั้งต้น ${formatMonth(forecastArchiveIssueMonth ?? forecastArchiveIssueMonthForSelection(forecastArchiveMonth, forecastArchiveHorizon ?? 1), "th")}`
      : "ยังไม่มีข้อมูลพยากรณ์สำหรับรอบนี้";

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
