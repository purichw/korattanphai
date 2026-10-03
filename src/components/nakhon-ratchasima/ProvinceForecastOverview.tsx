import { AlertTriangle, ArrowRight, Leaf } from "lucide-react";
import { useMemo, useState } from "react";
import { getNakhonRatchasimaDistrictByCode, getNakhonRatchasimaDistricts, type NakhonRatchasimaRouteTarget } from "../../domain";
import { formatMonth } from "../../i18n";
import { forecastSubdistrictCodesForIrrigation } from "../../irrigation";
import type { NakhonRatchasimaDroughtForecastArchive } from "../../types";
import { useForecastArchive } from "../../useForecastArchive";
import { ArchiveUnavailableState } from "../ArchiveUnavailableState";
import { DataProvenanceChip } from "../DataProvenanceChip";
import { ForecastArchiveRequest } from "../ForecastArchiveRequest";
import { IrrigationEmptyState } from "../IrrigationEmptyState";
import { OperationalFilters } from "../OperationalFilters";
import { MetricGrid } from "../PageSummary";
import { ForecastOverviewLoading } from "./ForecastArchiveLoading";
import { DroughtForecastArchiveSummaryMetrics } from "./ForecastControls";
import { forecastArchiveSummaryForSelection, pathWithForecastSelection, useDroughtForecastArchiveSelection } from "./forecastModel";
import { ForecastRiskAttention } from "./ForecastRiskAttention";
import { ProvinceDashboardMapCard } from "./ResearchPanels";
import { formatThaiNumber, pathForDistrictCode, pathForSubdistrictCode } from "./workspaceModel";

type OverviewProps = {
  onNavigate: (path: string) => void;
};

export function ProvinceForecastOverview(props: OverviewProps) {
  const request = useForecastArchive(true, "overview");
  const { archive, failed, retry } = request;
  if (request.periodUnavailable) return <ArchiveUnavailableState />;
  if (!archive) return <ForecastOverviewLoading failed={failed} retry={retry} />;
  return <ForecastArchiveRequest request={request}><ForecastOverviewContent {...props} archive={archive} /></ForecastArchiveRequest>;
}

function ForecastOverviewContent({ archive, onNavigate }: OverviewProps & {
  archive: NakhonRatchasimaDroughtForecastArchive;
}) {
  const forecast = useDroughtForecastArchiveSelection(archive, 1);
  const [districtCode, setDistrictCode] = useState(() => {
    const code = new URLSearchParams(window.location.search).get("district") ?? "";
    return getNakhonRatchasimaDistrictByCode(code) ? code : "";
  });
  const [selectedSubdistrictCode, setSelectedSubdistrictCode] = useState<string | null>(null);
  const district = getNakhonRatchasimaDistrictByCode(districtCode);
  const month = forecast.selectedMonth;
  const codes = useMemo(() => forecastSubdistrictCodesForIrrigation(archive, forecast.selectedIrrigation, district?.subdistricts.map((area) => area.subdistrictCode)), [archive, forecast.selectedIrrigation, district]);
  const summary = useMemo(() => month ? forecastArchiveSummaryForSelection(archive, month, 1, codes) : null, [archive, month, codes]);
  if (!month || !summary) return <section className="nr-archive-load-state"><p role="status">ยังไม่มีข้อมูลพยากรณ์สำหรับรอบนี้</p><a href="/drought" className="secondary-button">ดูคลังพยากรณ์ย้อนหลัง<ArrowRight size={16} /></a></section>;

  const scopeLabel = district ? `อ.${district.nameTh}` : "จ.นครราชสีมา";
  const target: NakhonRatchasimaRouteTarget = district
    ? { valid: true, level: "district", district }
    : { valid: true, level: "province", tab: "overview" };
  const withForecast = (path: string) => pathWithForecastSelection(path, month.period, 1, forecast.selectedIrrigation);
  const detailsHref = withForecast((selectedSubdistrictCode && pathForSubdistrictCode(selectedSubdistrictCode))
    || (district && pathForDistrictCode(district.districtCode)) || "/drought");
  const changeDistrict = (value: string) => {
    setDistrictCode(value);
    setSelectedSubdistrictCode(null);
    const url = new URL(window.location.href);
    if (value) url.searchParams.set("district", value);
    else url.searchParams.delete("district");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  };
  const changeMonth = (period: string) => {
    forecast.changeTargetMonth(period);
    setSelectedSubdistrictCode(null);
  };
  const hasRisk = summary.highRiskSubdistricts + summary.moderateRiskSubdistricts > 0;

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
      <MetricGrid className="nr-home-situation is-forecast-only" variant="segmented" ariaLabel="สถานการณ์ในภาพรวม" metrics={[
        { label: "ผลพยากรณ์ภัยแล้ง", value: codes.length === 0 ? "ไม่มีตำบลตรงตัวกรอง" : summary.inScopeSubdistricts === 0 ? "ไม่มีค่าพยากรณ์" : hasRisk ? "พบพื้นที่เสี่ยง" : "ไม่พบสัญญาณเสี่ยง", icon: <AlertTriangle size={24} />, tone: summary.inScopeSubdistricts === 0 ? "muted" : hasRisk ? "watch" : "good" },
        { label: "พืชที่ประเมิน", value: "ข้าว", icon: <Leaf size={24} /> },
      ]} />
      <div className="nr-forecast-overview-grid">
        <div className="nr-forecast-overview-map nr-overview-cockpit-map">
          <ProvinceDashboardMapCard
            irrigation={{ ...forecast.irrigation, onChange: (value) => {
              forecast.changeIrrigation(value);
              setSelectedSubdistrictCode(null);
            } }}
            filteredSubdistrictCodes={forecast.selectedIrrigation === "all" ? undefined : codes}
            target={target}
            compactOverview
            activeTab="overview"
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
        <ForecastRiskAttention key={`${month.period}:${districtCode}:${forecast.selectedIrrigation}`}
          summary={summary} hrefForSubdistrict={code => withForecast(pathForSubdistrictCode(code) ?? "/drought")} />
      </div>
    </section>
  );
}
