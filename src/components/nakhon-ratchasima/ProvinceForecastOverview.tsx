import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ChevronRight, RotateCcw } from "lucide-react";
import { getNakhonRatchasimaDistrictByCode, getNakhonRatchasimaDistricts, type NakhonRatchasimaRouteTarget } from "../../domain";
import type { NakhonRatchasimaDroughtForecastArchive, NakhonRatchasimaMapLayer } from "../../types";
import { useForecastArchive } from "../../useForecastArchive";
import { formatMonth } from "../../i18n";
import { OperationalFilters } from "../OperationalFilters";
import { DataProvenanceChip } from "../DataProvenanceChip";
import { DroughtForecastArchiveSummaryMetrics } from "./ForecastControls";
import { ProvinceDashboardMapCard } from "./ResearchPanels";
import { forecastArchiveSummaryForSelection, useDroughtForecastArchiveSelection, writeForecastArchiveLocation } from "./forecastModel";
import { formatThaiNumber, pathForDistrictCode, pathForSubdistrictCode, type LocalMapMode } from "./workspaceModel";

type OverviewProps = {
  layer: NakhonRatchasimaMapLayer;
  mapMode: LocalMapMode;
  onMapModeChange: (mode: LocalMapMode) => void;
  onNavigate: (path: string) => void;
};

export function ProvinceForecastOverview(props: OverviewProps) {
  const { archive, failed, retry } = useForecastArchive(true, "overview");
  if (!archive) return (
    <section className="nr-archive-load-state" aria-busy={!failed}>
      <p role={failed ? "alert" : "status"}>
        {failed ? "โหลดข้อมูลพยากรณ์ไม่สำเร็จ กรุณาลองใหม่" : "กำลังโหลดภาพรวมพยากรณ์ภัยแล้ง"}
      </p>
      {failed && <button type="button" className="secondary-button" onClick={retry}><RotateCcw size={16} /> ลองใหม่</button>}
    </section>
  );
  return <ForecastOverviewContent {...props} archive={archive} />;
}

function ForecastOverviewContent({ archive, layer, mapMode, onMapModeChange, onNavigate }: OverviewProps & {
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
  const codes = useMemo(() => district?.subdistricts.map((area) => area.subdistrictCode), [district]);
  const summary = useMemo(() => month ? forecastArchiveSummaryForSelection(archive, month, 1, codes) : null, [archive, month, codes]);
  useEffect(() => { if (month) writeForecastArchiveLocation(month, 1); }, [month]);
  if (!month || !summary) return <p role="status">ยังไม่มีคำพยากรณ์สำหรับภาพรวม</p>;

  const scopeLabel = district ? `อ.${district.nameTh}` : "จ.นครราชสีมา";
  const target: NakhonRatchasimaRouteTarget = district
    ? { valid: true, level: "district", district }
    : { valid: true, level: "province", tab: "overview" };
  const attention = [...summary.recordsBySubdistrict.values()]
    .filter((record) => record.forecastRisk === 2)
    .sort((a, b) => a.subdistrictCode.localeCompare(b.subdistrictCode))
    .slice(0, 3);
  const withForecast = (path: string) => {
    const url = new URL(path, window.location.origin);
    url.searchParams.set("mapLayer", "forecast-archive");
    url.searchParams.set("target", month.period);
    url.searchParams.set("horizon", "1");
    return `${url.pathname}${url.search}`;
  };
  const detailsHref = withForecast((selectedSubdistrictCode && pathForSubdistrictCode(selectedSubdistrictCode))
    || (district && pathForDistrictCode(district.districtCode)) || "/drought");
  const changeDistrict = (value: string) => {
    setDistrictCode(value);
    setSelectedSubdistrictCode(null);
    const url = new URL(window.location.href);
    if (value) url.searchParams.set("district", value);
    else url.searchParams.delete("district");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  };

  return (
    <section className="nr-forecast-overview" aria-label="ภาพรวมพยากรณ์ภัยแล้ง">
      <header className="nr-forecast-overview-heading nr-dashboard-heading">
        <div>
          <p className="eyebrow">ภาพรวมพยากรณ์ภัยแล้ง</p>
          <h2>จังหวัดนครราชสีมา</h2>
        </div>
        <p>เดือนเป้าหมายล่าสุดในชุดข้อมูล {formatMonth(archive.meta.targetMonthEnd, "th")} <DataProvenanceChip kind="REAL" /></p>
      </header>
      <OperationalFilters
        monthOptions={forecast.targetMonthOptions}
        monthValue={month.period}
        onMonthChange={(period) => { forecast.changeTargetMonth(period); setSelectedSubdistrictCode(null); }}
        areaLabel="อำเภอ"
        areaValue={districtCode}
        areaOptions={[{ value: "", label: "ทุกอำเภอ" }, ...getNakhonRatchasimaDistricts().map((area) => ({ value: area.districtCode, label: area.nameTh ?? area.name }))]}
        onAreaChange={changeDistrict}
        contextChips={[{ label: "ระยะพยากรณ์", value: "T+1" }]}
        ariaLabel="ตัวกรองภาพรวมพยากรณ์"
      />
      <p className="nr-forecast-overview-context">
        <strong>พยากรณ์ {month.labelTh}</strong>
        <span>ล่วงหน้า 1 เดือน (T+1) · ออกคำพยากรณ์ {formatMonth(summary.issueMonth, "th")}</span>
      </p>
      <div className="nr-forecast-overview-grid">
        <div className="nr-forecast-overview-map nr-overview-cockpit-map">
          <ProvinceDashboardMapCard
            target={target}
            activeTab="overview"
            layer={layer}
            mapMode={mapMode}
            onMapModeChange={onMapModeChange}
            onNavigate={(path) => onNavigate(withForecast(path))}
            selectedMonth={month.period}
            monthOptions={forecast.targetMonthOptions}
            onMonthChange={forecast.changeTargetMonth}
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
          <p className="nr-forecast-overview-scope-note">นอกขอบเขตการศึกษา คือไม่มีค่าพยากรณ์ในชุดข้อมูลสำหรับตำบลนั้น</p>
        </section>
        <section className="nr-forecast-overview-attention" aria-label="ตำบลที่พยากรณ์เสี่ยงสูง">
          <h3>ตำบลที่พยากรณ์เสี่ยงสูง</h3>
          {attention.length > 0 ? <>
            <p>{formatThaiNumber(attention.length)} จาก {formatThaiNumber(summary.highRiskSubdistricts)} ตำบล · เรียงตามรหัสตำบล</p>
            <ul>
              {attention.map((record) => (
                <li key={record.subdistrictCode}>
                  <a href={withForecast(pathForSubdistrictCode(record.subdistrictCode) ?? "/drought")}>
                    <span><strong>{record.subdistrictNameTh}</strong><small>อ.{record.districtNameTh}</small></span>
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
      <details className="nr-forecast-overview-source">
        <summary>แหล่งข้อมูลและช่วงเวลาพยากรณ์</summary>
        <p>คลังพยากรณ์ภัยแล้ง rev02 · เดือนเป้าหมาย {formatMonth(archive.meta.targetMonthStart, "th")} ถึง {formatMonth(archive.meta.targetMonthEnd, "th")}</p>
        <p>ผลพยากรณ์ย้อนหลังจากแบบจำลอง ไม่ใช่รายงานสถานการณ์จริงหรือประกาศภัยทางการ</p>
        <p>แหล่งข้อมูล: {archive.meta.sourceWorkbook}</p>
      </details>
    </section>
  );
}
