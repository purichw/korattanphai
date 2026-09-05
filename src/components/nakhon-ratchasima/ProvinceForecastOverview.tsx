import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, ChevronDown, ChevronRight, Gauge, Leaf, Map as MapIcon, RotateCcw, ShieldAlert } from "lucide-react";
import { formatRai, getNakhonRatchasimaDistrictByCode, getNakhonRatchasimaDistricts, type NakhonRatchasimaRouteTarget } from "../../domain";
import type { NakhonRatchasimaDroughtForecastArchive, NakhonRatchasimaMapLayer, ProvinceMonthRisk } from "../../types";
import { useForecastArchive } from "../../useForecastArchive";
import { formatMonth, labelConfidence } from "../../i18n";
import { OperationalFilters } from "../OperationalFilters";
import { DataProvenanceChip, dataProvenanceChipKindFromText } from "../DataProvenanceChip";
import { DroughtForecastArchiveSummaryMetrics } from "./ForecastControls";
import { AgricultureImpactPanel, PredictionReadinessPanel, ProvinceDashboardMapCard } from "./ResearchPanels";
import { MetricGrid, type SummaryMetric } from "../PageSummary";
import { forecastArchiveSummaryForSelection, pathWithForecastSelection, useDroughtForecastArchiveSelection, writeForecastArchiveLocation } from "./forecastModel";
import { formatThaiNumber, pathForDistrictCode, pathForSubdistrictCode, predictionReadinessSummaryForSubdistrictCodes, prefersReducedMotion, type LocalMapMode } from "./workspaceModel";

type OverviewProps = {
  layer: NakhonRatchasimaMapLayer;
  mapMode: LocalMapMode;
  onMapModeChange: (mode: LocalMapMode) => void;
  onNavigate: (path: string) => void;
  provinceRecord: ProvinceMonthRisk | undefined;
};

export function ProvinceForecastOverview(props: OverviewProps) {
  const { archive, failed, retry } = useForecastArchive(true, "overview");
  if (!archive) return (
    <section className="nr-archive-load-state" aria-busy={!failed}>
      <p role={failed ? "alert" : "status"}>
        {failed ? "โหลดข้อมูลพยากรณ์ไม่สำเร็จ กรุณาลองใหม่" : "กำลังโหลดภาพรวมพยากรณ์ภัยแล้ง"}
      </p>
      {failed && <button type="button" className="secondary-button" onClick={retry}><RotateCcw size={16} /> ลองใหม่</button>}
      <a className="secondary-button" href="/drought">ดูคลังพยากรณ์ย้อนหลัง<ArrowRight size={16} /></a>
    </section>
  );
  return <ForecastOverviewContent {...props} archive={archive} />;
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
  const [readinessMode, setReadinessMode] = useState(false);
  const district = getNakhonRatchasimaDistrictByCode(districtCode);
  const month = forecast.selectedMonth;
  const codes = useMemo(() => district?.subdistricts.map((area) => area.subdistrictCode), [district]);
  const summary = useMemo(() => month ? forecastArchiveSummaryForSelection(archive, month, 1, codes) : null, [archive, month, codes]);
  const readiness = useMemo(() => predictionReadinessSummaryForSubdistrictCodes(codes ?? getNakhonRatchasimaDistricts().flatMap((area) => area.subdistricts.map((item) => item.subdistrictCode))), [codes]);
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
  const withForecast = (path: string) => pathWithForecastSelection(path, month.period, 1);
  const detailsHref = withForecast((selectedSubdistrictCode && pathForSubdistrictCode(selectedSubdistrictCode))
    || (district && pathForDistrictCode(district.districtCode)) || "/drought");
  const changeDistrict = (value: string) => {
    setDistrictCode(value);
    setSelectedSubdistrictCode(null);
    setShowAllAttention(false);
    setReadinessMode(false);
    const url = new URL(window.location.href);
    if (value) url.searchParams.set("district", value);
    else url.searchParams.delete("district");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  };
  const changeMonth = (period: string) => {
    forecast.changeTargetMonth(period);
    setSelectedSubdistrictCode(null);
    setShowAllAttention(false);
    setReadinessMode(false);
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
          <p className="nr-forecast-overview-context"><strong>พยากรณ์ {month.labelTh}</strong><span>ล่วงหน้า 1 เดือน (T+1) · ออกคำพยากรณ์ {formatMonth(summary.issueMonth, "th")}</span></p>
        </div>
        <p><DataProvenanceChip kind="REAL" />เป้าหมายล่าสุดในคลัง {formatMonth(archive.meta.targetMonthEnd, "th")} · ไม่ใช่ข้อมูลสด</p>
      </header>
      <OperationalFilters
        compactOverview
        monthOptions={forecast.targetMonthOptions.map((option) => ({ ...option, triggerLabel: `${formatMonth(option.value, "th")} (T+1)` }))}
        monthValue={month.period}
        onMonthChange={changeMonth}
        areaLabel="อำเภอ"
        areaValue={districtCode}
        areaOptions={[{ value: "", label: "ทุกอำเภอ" }, ...getNakhonRatchasimaDistricts().map((area) => ({ value: area.districtCode, label: area.nameTh ?? area.name }))]}
        onAreaChange={changeDistrict}
        contextChips={[{ label: "ระยะพยากรณ์", value: "T+1" }]}
        ariaLabel="ตัวกรองภาพรวมพยากรณ์"
      />
      <MetricGrid className={`nr-home-situation${hasAgriculture ? "" : " is-forecast-only"}`} variant="segmented" ariaLabel="สถานการณ์ในภาพรวม" metrics={[
        { label: "ผลพยากรณ์ภัยแล้ง", value: summary.inScopeSubdistricts === 0 ? "ไม่มีค่าพยากรณ์" : hasRisk ? "พบพื้นที่เสี่ยง" : "ไม่พบสัญญาณเสี่ยง", icon: <AlertTriangle size={24} />, tone: summary.inScopeSubdistricts === 0 ? "muted" : hasRisk ? "watch" : "good" },
        { label: "พืชที่ประเมิน", value: "ข้าว", icon: <Leaf size={24} /> },
        ...agricultureMetrics,
      ]} />
      <div className="nr-forecast-overview-grid">
        <div className="nr-forecast-overview-map nr-overview-cockpit-map">
          <ProvinceDashboardMapCard
            target={target}
            compactOverview
            readinessMode={readinessMode}
            onCloseReadiness={() => setReadinessMode(false)}
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
            showMonthFilter={false}
            selectedSubdistrictCode={selectedSubdistrictCode}
            onSelectedSubdistrictChange={setSelectedSubdistrictCode}
          />
        </div>
        <section className="nr-forecast-overview-summary" aria-label="สรุปพยากรณ์พื้นที่ที่เลือก">
          <div className="nr-forecast-overview-summary-heading">
            <h3>สรุปพยากรณ์ {scopeLabel}</h3>
            <p>อยู่ในขอบเขต {formatThaiNumber(summary.inScopeSubdistricts)}/{formatThaiNumber(summary.totalSubdistricts)} ตำบล</p>
          </div>
          <DroughtForecastArchiveSummaryMetrics level={district ? "district" : "province"} summary={summary} variant="overview" />
          {summary.matchedSubdistricts === 0 && <p role="status">ยังไม่มีข้อมูลสำหรับรอบนี้ · เลือกเดือนอื่นหรือดูคลังพยากรณ์ย้อนหลัง</p>}
          <p className="nr-forecast-overview-scope-note">นอกขอบเขตการศึกษา คือไม่มีค่าพยากรณ์ในชุดข้อมูลสำหรับตำบลนั้น</p>
        </section>
        <section className="nr-forecast-overview-attention" aria-label="ตำบลที่พยากรณ์เสี่ยงสูง">
          <div className="nr-home-attention-heading"><h3>ตำบลที่พยากรณ์เสี่ยงสูง</h3>
            {allAttention.length > 3 && <button type="button" className="nr-home-text-action" aria-expanded={showAllAttention} aria-controls="home-attention-list" onClick={() => setShowAllAttention(!showAllAttention)}>{showAllAttention ? "ย่อรายการ" : "ดูทั้งหมด"}<ChevronDown size={16} /></button>}
          </div>
          {attention.length > 0 ? <>
            <p className={showAllAttention ? "is-expanded" : "nr-home-list-context"}>{formatThaiNumber(attention.length)} จาก {formatThaiNumber(summary.highRiskSubdistricts)} ตำบล · เรียงตามรหัสตำบล</p>
            <ul id="home-attention-list" className={showAllAttention ? "is-expanded" : ""}>
              {attention.map((record, index) => (
                <li key={record.subdistrictCode}>
                  <a href={withForecast(pathForSubdistrictCode(record.subdistrictCode) ?? "/drought")}>
                    <b className="nr-home-rank">{index + 1}</b><span className="nr-home-area-name"><strong>ต.{record.subdistrictNameTh}</strong><small>อ.{record.districtNameTh}</small></span>
                    <span className="status-pill severe">เสี่ยงสูง</span><ChevronRight size={16} />
                  </a>
                </li>
              ))}
            </ul>
          </> : <p>{summary.inScopeSubdistricts === 0 ? "ไม่มีค่าพยากรณ์ในขอบเขตที่เลือก" : "ไม่พบตำบลที่พยากรณ์เสี่ยงสูงในเดือนที่เลือก"}</p>}
          <a className="secondary-button nr-forecast-overview-details" href={detailsHref}>
            ดูพยากรณ์ T+1–T+6{district ? ` · ${scopeLabel}` : ""}<ArrowRight size={16} />
          </a>
        </section>
      </div>
      <section className={`nr-home-support${hasAgriculture ? "" : " is-forecast-only"}`} aria-label={hasAgriculture ? "ข้อมูลเกษตรและความพร้อมข้อมูล" : "ความพร้อมข้อมูลและคลังพยากรณ์"}>
        <AgricultureImpactPanel provinceRecord={provinceRecord} compact />
        <PredictionReadinessPanel compact readiness={readiness} onOpenMap={() => {
          setReadinessMode(true);
          setSelectedSubdistrictCode(null);
          window.requestAnimationFrame(() => document.querySelector(".nr-forecast-overview-map")?.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" }));
        }} />
        <section className="nr-home-archive"><h3><MapIcon size={22} aria-hidden="true" />คลังพยากรณ์ย้อนหลัง</h3><a href={withForecast("/drought")}><MapIcon size={30} aria-hidden="true" /><span><strong>ดูสถานการณ์ย้อนหลัง</strong><small>T+1 ถึง T+6</small></span><ArrowRight size={20} /></a></section>
      </section>
      <footer className="nr-home-footer">
      <p className="nr-forecast-overview-support-note">{hasAgriculture ? `ข้อมูลเกษตรระดับจังหวัด · ${formatMonth(provinceRecord.month, "th")} · ตัวเลขไร่และความเชื่อมั่นเป็นคนละชุดกับพยากรณ์รายตำบล` : "ความพร้อมข้อมูลเป็นข้อมูลประกอบ ไม่ใช่ความแม่นยำของแบบจำลองพยากรณ์"}</p>
      </footer>
    </section>
  );
}
