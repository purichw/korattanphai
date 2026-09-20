import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, ChevronDown, ChevronRight, ClipboardCheck, Gauge, Info, Leaf, MapPin, ShieldAlert } from "lucide-react";
import { formatRai, getNakhonRatchasimaDistrictByCode, getNakhonRatchasimaDistricts, type NakhonRatchasimaRouteTarget } from "../../domain";
import type { NakhonRatchasimaDroughtForecastArchive, NakhonRatchasimaMapLayer, ProvinceMonthRisk } from "../../types";
import { useForecastArchive } from "../../useForecastArchive";
import { ForecastArchiveRequest } from "../ForecastArchiveRequest";
import { formatMonth, labelConfidence } from "../../i18n";
import { OperationalFilters } from "../OperationalFilters";
import { DataProvenanceChip, dataProvenanceChipKindFromText } from "../DataProvenanceChip";
import { DroughtForecastArchiveSummaryMetrics } from "./ForecastControls";
import { AgricultureImpactPanel, ProvinceDashboardMapCard } from "./ResearchPanels";
import { MetricGrid, type SummaryMetric } from "../PageSummary";
import { forecastArchiveSummaryForSelection, pathWithForecastSelection, useDroughtForecastArchiveSelection, writeForecastArchiveLocation } from "./forecastModel";
import { formatThaiNumber, pathForDistrictCode, pathForSubdistrictCode, type LocalMapMode } from "./workspaceModel";
import { forecastSubdistrictCodesForIrrigation } from "../../irrigation";
import { ForecastOverviewLoading } from "./ForecastArchiveLoading";
import { IrrigationEmptyState } from "../IrrigationEmptyState";
import { ArchiveUnavailableState } from "../ArchiveUnavailableState";

type OverviewProps = {
  layer: NakhonRatchasimaMapLayer;
  mapMode: LocalMapMode;
  onMapModeChange: (mode: LocalMapMode) => void;
  onNavigate: (path: string) => void;
  provinceRecord: ProvinceMonthRisk | undefined;
};

export function ProvinceForecastOverview(props: OverviewProps) {
  const request = useForecastArchive(true, "overview");
  const { archive, failed, retry } = request;
  if (request.periodUnavailable) return <ArchiveUnavailableState />;
  if (!archive) return <ForecastOverviewLoading failed={failed} retry={retry} />;
  return <ForecastArchiveRequest request={request}><ForecastOverviewContent {...props} archive={archive} /></ForecastArchiveRequest>;
}

function ForecastOverviewContent({ archive, layer, mapMode, onMapModeChange, onNavigate, provinceRecord }: OverviewProps & {
  archive: NakhonRatchasimaDroughtForecastArchive;
}) {
  const forecast = useDroughtForecastArchiveSelection(archive, 1);
  const [districtCode, setDistrictCode] = useState(() => {
    const code = new URLSearchParams(window.location.search).get("district") ?? "";
    return getNakhonRatchasimaDistrictByCode(code) ? code : "";
  });
  const [selectedSubdistrictCode, setSelectedSubdistrictCode] = useState<string | null>(null);
  const [showAllAttention, setShowAllAttention] = useState(false);
  const district = getNakhonRatchasimaDistrictByCode(districtCode);
  const month = forecast.selectedMonth;
  const codes = useMemo(() => forecastSubdistrictCodesForIrrigation(archive, forecast.selectedIrrigation, district?.subdistricts.map((area) => area.subdistrictCode)), [archive, forecast.selectedIrrigation, district]);
  const summary = useMemo(() => month ? forecastArchiveSummaryForSelection(archive, month, 1, codes) : null, [archive, month, codes]);
  useEffect(() => { if (month) writeForecastArchiveLocation(month, 1); }, [month]);
  if (!month || !summary) return <section className="nr-archive-load-state"><p role="status">ยังไม่มีข้อมูลพยากรณ์สำหรับรอบนี้</p><a href="/drought" className="secondary-button">ดูคลังพยากรณ์ย้อนหลัง<ArrowRight size={16} /></a></section>;

  const scopeLabel = district ? `อ.${district.nameTh}` : "จ.นครราชสีมา";
  const target: NakhonRatchasimaRouteTarget = district
    ? { valid: true, level: "district", district }
    : { valid: true, level: "province", tab: "overview" };
  const allAttention = [...summary.recordsBySubdistrict.values()]
    .filter((record) => record.forecastRisk === 2)
    .sort((a, b) => a.subdistrictCode.localeCompare(b.subdistrictCode));
  const attention = showAllAttention ? allAttention : allAttention.slice(0, 3);
  const withForecast = (path: string) => pathWithForecastSelection(path, month.period, 1, forecast.selectedIrrigation);
  const detailsHref = withForecast((selectedSubdistrictCode && pathForSubdistrictCode(selectedSubdistrictCode))
    || (district && pathForDistrictCode(district.districtCode)) || "/drought");
  const changeDistrict = (value: string) => {
    setDistrictCode(value);
    setSelectedSubdistrictCode(null);
    setShowAllAttention(false);
    const url = new URL(window.location.href);
    if (value) url.searchParams.set("district", value);
    else url.searchParams.delete("district");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  };
  const changeMonth = (period: string) => {
    forecast.changeTargetMonth(period);
    setSelectedSubdistrictCode(null);
    setShowAllAttention(false);
  };
  const hasRisk = summary.highRiskSubdistricts + summary.moderateRiskSubdistricts > 0;
  const hasAgriculture = provinceRecord && dataProvenanceChipKindFromText(provinceRecord.provenance) === "REAL";
  // Keep the agriculture design available, but never fill it with prototype data.
  const agricultureMetrics: SummaryMetric[] = hasAgriculture ? [
    { label: "พื้นที่ประเมินทั้งจังหวัด", value: `${formatRai(provinceRecord.agriculturalAreaExposedRai)} ไร่`, icon: <Gauge size={24} /> },
    { label: "ความเชื่อมั่นข้อมูลเกษตร", value: labelConfidence(provinceRecord.confidence, "th"), icon: <ShieldAlert size={24} />, tone: provinceRecord.confidence === "High" ? "good" : provinceRecord.confidence === "Medium" ? "watch" : "muted" },
  ] : [];

  return (
    <section className="nr-forecast-overview" aria-label="ภาพรวมพยากรณ์ภัยแล้ง">
      <header className="nr-forecast-overview-heading nr-dashboard-heading">
        <div>
          <p className="eyebrow">ภาพรวมสถานการณ์</p>
          <h1>จังหวัดนครราชสีมา</h1>
          <p className="nr-forecast-overview-context"><strong>พยากรณ์ {formatMonth(summary.targetMonth, "th")}</strong><span>ล่วงหน้า 1 เดือน · เดือนตั้งต้น (T) {formatMonth(summary.issueMonth, "th")}</span></p>
        </div>
        <p><DataProvenanceChip kind="FORECAST_ARCHIVE" />เดือนตั้งต้นล่าสุดในคลัง {formatMonth(archive.meta.targetMonthEnd, "th")} · ไม่ใช่ข้อมูลสด</p>
      </header>
      <OperationalFilters
        compactOverview
        monthFieldLabel="เดือนตั้งต้น"
        monthOptions={forecast.targetMonthOptions}
        monthValue={month.period}
        onMonthChange={changeMonth}
        areaLabel="อำเภอ"
        areaValue={districtCode}
        areaOptions={[{ value: "", label: "ทุกอำเภอ" }, ...getNakhonRatchasimaDistricts().map((area) => ({ value: area.districtCode, label: area.nameTh ?? area.name }))]}
        onAreaChange={changeDistrict}
        contextChips={[{ label: "ระยะพยากรณ์", value: "ล่วงหน้า 1 เดือน" }]}
        ariaLabel="ตัวกรองภาพรวมพยากรณ์"
      />
      <MetricGrid className={`nr-home-situation${hasAgriculture ? "" : " is-forecast-only"}`} variant="segmented" ariaLabel="สถานการณ์ในภาพรวม" metrics={[
        { label: "ผลพยากรณ์ภัยแล้ง", value: codes.length === 0 ? "ไม่มีตำบลตรงตัวกรอง" : summary.inScopeSubdistricts === 0 ? "ไม่มีค่าพยากรณ์" : hasRisk ? "พบพื้นที่เสี่ยง" : "ไม่พบสัญญาณเสี่ยง", icon: <AlertTriangle size={24} />, tone: summary.inScopeSubdistricts === 0 ? "muted" : hasRisk ? "watch" : "good" },
        { label: "พืชที่ประเมิน", value: "ข้าว", icon: <Leaf size={24} /> },
        ...agricultureMetrics,
      ]} />
      <div className="nr-forecast-overview-grid">
        <div className="nr-forecast-overview-map nr-overview-cockpit-map">
          <ProvinceDashboardMapCard
            irrigation={{ ...forecast.irrigation, onChange: (value) => {
              forecast.changeIrrigation(value);
              setSelectedSubdistrictCode(null);
              setShowAllAttention(false);
            } }}
            filteredSubdistrictCodes={forecast.selectedIrrigation === "all" ? undefined : codes}
            target={target}
            compactOverview
            activeTab="overview"
            layer={layer}
            mapMode={mapMode}
            onMapModeChange={onMapModeChange}
            onNavigate={(path) => onNavigate(withForecast(path))}
            selectedMonth={month.period}
            monthOptions={forecast.targetMonthOptions}
            onMonthChange={changeMonth}
            forecastArchive={archive}
            forecastArchiveMonth={month}
            forecastArchiveHorizon={1}
            forecastArchiveIssueMonth={summary.issueMonth}
            selectedSubdistrictCode={selectedSubdistrictCode}
            onSelectedSubdistrictChange={setSelectedSubdistrictCode}
          />
        </div>
        <section className="nr-forecast-overview-summary" aria-label="สรุปพยากรณ์พื้นที่ที่เลือก">
          <div className="nr-forecast-overview-summary-heading">
            <div className="nr-forecast-overview-summary-copy">
              <h3>สรุปพยากรณ์ {scopeLabel}</h3>
              <p>อยู่ในขอบเขต {formatThaiNumber(summary.inScopeSubdistricts)}/{formatThaiNumber(summary.totalSubdistricts)} ตำบล</p>
            </div>
            <a className="primary-button nr-forecast-overview-details" href={detailsHref}>
              ดูพยากรณ์ล่วงหน้า 6 เดือน{district ? ` · ${scopeLabel}` : ""}<ArrowRight size={16} />
            </a>
          </div>
          {codes.length === 0 ? <IrrigationEmptyState onReset={() => forecast.changeIrrigation("all")} />
            : <DroughtForecastArchiveSummaryMetrics level={district ? "district" : "province"} summary={summary} variant="overview" />}
          {codes.length > 0 && summary.matchedSubdistricts === 0 && <p role="status">ยังไม่มีข้อมูลสำหรับรอบนี้ · เลือกเดือนอื่นหรือดูคลังพยากรณ์ย้อนหลัง</p>}
          <p className="nr-forecast-overview-scope-note">นอกขอบเขตการศึกษา คือไม่มีค่าพยากรณ์ในชุดข้อมูลสำหรับตำบลนั้น</p>
        </section>
        <section className={`nr-forecast-overview-attention${attention.length === 0 ? " is-empty" : ""}`} aria-label="ตำบลที่พยากรณ์เสี่ยงสูง">
          <div className="nr-home-attention-heading"><h3>ตำบลที่พยากรณ์เสี่ยงสูง</h3>
            {allAttention.length > 3 && <button type="button" className="nr-home-text-action" aria-expanded={showAllAttention} aria-controls="home-attention-list" onClick={() => setShowAllAttention(!showAllAttention)}>{showAllAttention ? "ย่อรายการ" : "ดูทั้งหมด"}<ChevronDown size={16} /></button>}
          </div>
          {attention.length > 0 ? <>
            <p className={showAllAttention ? "is-expanded" : "nr-home-list-context"}>{formatThaiNumber(attention.length)} จาก {formatThaiNumber(summary.highRiskSubdistricts)} ตำบล · เรียงตามรหัสตำบล</p>
            <ul id="home-attention-list" className={showAllAttention ? "is-expanded" : ""}>
              {attention.map((record) => (
                <li key={record.subdistrictCode}>
                  <a href={withForecast(pathForSubdistrictCode(record.subdistrictCode) ?? "/drought")}>
                    <span className="nr-home-area-marker" aria-hidden="true"><MapPin size={18} /></span><span className="nr-home-area-name"><strong>ต.{record.subdistrictNameTh}</strong><small>อ.{record.districtNameTh}</small></span>
                    <span className="status-pill severe">เสี่ยงสูง</span><ChevronRight size={16} />
                  </a>
                </li>
              ))}
            </ul>
          </> : <div className="nr-home-attention-empty" role="status">
            <span className="nr-home-attention-empty-icon" aria-hidden="true">
              {summary.inScopeSubdistricts === 0 ? <Info size={28} /> : <ClipboardCheck size={28} />}
            </span>
            <strong>{summary.inScopeSubdistricts === 0 ? "ไม่มีค่าพยากรณ์ในขอบเขตที่เลือก" : "ไม่พบตำบลที่พยากรณ์เสี่ยงสูง"}</strong>
            <p>เดือนพยากรณ์ {formatMonth(summary.targetMonth, "th")}</p>
            <small>{summary.inScopeSubdistricts === 0
              ? "ยังไม่สามารถสรุปความเสี่ยงของพื้นที่นี้ได้"
              : summary.moderateRiskSubdistricts > 0
                ? `ยังมีตำบลเสี่ยงปานกลาง ${formatThaiNumber(summary.moderateRiskSubdistricts)} ตำบล`
                : "เฉพาะตำบลที่มีค่าพยากรณ์ในขอบเขตที่เลือก"}</small>
          </div>}
        </section>
      </div>
      {hasAgriculture && <section className="nr-home-support" aria-label="ข้อมูลเกษตร">
        <AgricultureImpactPanel provinceRecord={provinceRecord} compact />
      </section>}
      {hasAgriculture && <footer className="nr-home-footer">
        <p className="nr-forecast-overview-support-note">ข้อมูลเกษตรระดับจังหวัด · {formatMonth(provinceRecord.month, "th")} · ตัวเลขไร่และความเชื่อมั่นเป็นคนละชุดกับพยากรณ์รายตำบล</p>
      </footer>}
    </section>
  );
}
