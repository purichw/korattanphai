import { type ReactNode } from "react";
import { Activity, ArrowLeft, CalendarDays, ChevronRight, Database, MapPin, ShieldCheck, Sprout, TrendingUp } from "lucide-react";
import { AppSelect, type AppSelectOption } from "../AppSelect";
import { ForecastMonthSelect } from "../ForecastArchiveRequest";
import { forecastHorizonLabel } from "../../forecastPeriod";
import { MetricCard } from "../PageSummary";
import { type DroughtForecastWorkspaceTarget, type DroughtForecastArchiveSummary, type ForecastArchiveHorizon, forecastArchiveHorizonValues } from "./forecastModel";
import { districtOptionsForProvince, formatThaiNumber, formatPercent, pathForDistrictCode, pathForSubdistrictCode, routeBackTargetForRoute } from "./workspaceModel";

export function DroughtWorkspaceHeader({ target, archiveLabel, onNavigate }: {
  target: DroughtForecastWorkspaceTarget;
  archiveLabel?: string;
  onNavigate: (path: string) => void;
}) {
  const back = routeBackTargetForRoute(target);
  const scope = target.level === "province" ? "จังหวัดนครราชสีมา"
    : target.level === "district" ? `อำเภอ${target.district.nameTh}`
      : `ตำบล${target.subdistrict.nameTh} · อำเภอ${target.district.nameTh}`;
  return <header className="nr-operational-header nr-drought-page-header">
    {back && <button className="nr-page-back-link" type="button" onClick={() => onNavigate(back.path)}>
      <ArrowLeft size={16} aria-hidden="true" />{back.label}
    </button>}
    <h1>ภัยแล้ง{target.level !== "province" && <span> · {scope}</span>}</h1>
    <p>ติดตามสถานการณ์และคาดการณ์พื้นที่เสี่ยงภัยแล้งของ{scope}</p>
    <small>{archiveLabel && <>เดือนตั้งต้นล่าสุดในคลัง {archiveLabel} · </>}ข้อมูลพยากรณ์ย้อนหลัง ไม่ใช่สถานการณ์ปัจจุบัน</small>
  </header>;
}

export function DroughtWorkspaceFilters({ target, selectedMonth, monthOptions, onMonthChange, selectedHorizon, onHorizonChange, onNavigate }: {
  target: DroughtForecastWorkspaceTarget;
  selectedMonth: string;
  monthOptions: AppSelectOption[];
  onMonthChange: (month: string) => void;
  selectedHorizon: ForecastArchiveHorizon;
  onHorizonChange: (horizon: ForecastArchiveHorizon) => void;
  onNavigate: (path: string) => void;
}) {
  const isProvince = target.level === "province";
  const areaOptions: AppSelectOption[] = isProvince
    ? [{ value: "", label: "ทุกอำเภอ" }, ...districtOptionsForProvince().map(({ value, label }) => ({ value, label }))]
    : [{ value: "", label: "ทุกตำบล" }, ...target.district.subdistricts.map((item) => ({ value: item.subdistrictCode, label: item.nameTh ?? item.name }))];
  return <section className="nr-operational-filters" aria-label="ตัวกรองข้อมูลพื้นที่นครราชสีมา">
    <ForecastMonthSelect label="เดือนตั้งต้น" ariaLabel="เดือนตั้งต้น" icon={<CalendarDays size={20} />} value={selectedMonth}
      compactValue options={monthOptions} onChange={onMonthChange} />
    <div className="nr-fixed-filter"><ShieldCheck size={20} aria-hidden="true" /><span>ภัย<strong>ภัยแล้ง</strong></span></div>
    <div className="nr-fixed-filter"><Sprout size={20} aria-hidden="true" /><span>พืช<strong>ข้าว</strong></span></div>
    <AppSelect className="nr-operational-area-filter" label={isProvince ? "อำเภอ" : "ตำบล"} icon={<MapPin size={20} />}
      value={target.level === "subdistrict" ? target.subdistrict.subdistrictCode : ""} options={areaOptions}
      onChange={(code) => {
        const path = isProvince ? pathForDistrictCode(code) : code ? pathForSubdistrictCode(code) : pathForDistrictCode(target.district.districtCode);
        if (path) onNavigate(path);
      }} />
    <AppSelect className="nr-operational-horizon-filter" label="ระยะพยากรณ์" icon={<TrendingUp size={20} />} value={String(selectedHorizon)}
      options={forecastArchiveHorizonValues.map((horizon) => ({ value: String(horizon), label: forecastHorizonLabel(horizon) }))}
      onChange={(value) => onHorizonChange(Number(value) as ForecastArchiveHorizon)} />
  </section>;
}

export function DroughtOperationalSummary({ horizon, summary }: {
  horizon: ForecastArchiveHorizon;
  summary: DroughtForecastArchiveSummary;
}) {
  const { riskPercent, riskSubdistricts, inScopeSubdistricts, totalSubdistricts } = summary;
  const state = riskPercent === null ? " has-no-data" : "";
  return <MetricCard
    className={`nr-operational-card-heading nr-operational-forecast-summary${state}`}
    label={<span role="heading" aria-level={3}>ตำบลที่พบความเสี่ยง ({forecastHorizonLabel(horizon)})</span>}
    value={riskPercent === null ? "ไม่มีค่าพยากรณ์ในรอบนี้" : formatPercent(riskPercent * 100, 1)}
    detail={<>
      {riskPercent !== null && <span>เสี่ยง {formatThaiNumber(riskSubdistricts)} จาก {formatThaiNumber(inScopeSubdistricts)} ตำบลที่มีค่าพยากรณ์</span>}
      <span>มีค่าพยากรณ์ {formatThaiNumber(inScopeSubdistricts)}/{formatThaiNumber(totalSubdistricts)} ตำบลทั้งหมด</span>
    </>}
    icon={<TrendingUp size={22} />}
  />;
}

export function DroughtOperationalDisclosure({ title, description, descriptionAlign = "center", icon = "activity", children, className = "" }: {
  title: string;
  description?: string;
  descriptionAlign?: "center" | "start";
  icon?: "activity" | "data" | "crop" | "map";
  children: ReactNode;
  className?: string;
}) {
  const Icon = icon === "data" ? Database : icon === "crop" ? Sprout : icon === "map" ? MapPin : Activity;
  return <details className={`nr-operational-disclosure ${className}`}>
    <summary className="nr-operational-card-heading"><Icon size={22} aria-hidden="true" /><span className="nr-operational-card-copy"><strong>{title}</strong>{description && <small className={`nr-operational-card-description is-${descriptionAlign}`}>{description}</small>}</span><ChevronRight size={18} aria-hidden="true" /></summary>
    <div className="nr-operational-disclosure-body">{children}</div>
  </details>;
}
