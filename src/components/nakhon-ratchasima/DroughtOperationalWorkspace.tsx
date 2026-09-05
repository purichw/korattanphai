import { useState, type ReactNode } from "react";
import { Activity, ArrowLeft, CalendarDays, ChevronRight, Database, MapPin, ShieldCheck, Sprout, TrendingUp } from "lucide-react";
import { AppSelect, type AppSelectOption } from "../AppSelect";
import { type DroughtForecastWorkspaceTarget, type ForecastArchiveHorizon, forecastArchiveHorizonValues } from "./forecastModel";
import { districtOptionsForProvince, pathForDistrictCode, pathForSubdistrictCode, routeBackTargetForRoute } from "./workspaceModel";

export function useDroughtReadinessMap() {
  const [readinessMap, setReadinessMap] = useState(false);
  return {
    readinessMap,
    closeReadinessMap: () => setReadinessMap(false),
    openReadinessMap: () => {
      setReadinessMap(true);
      window.requestAnimationFrame(() => document.querySelector(".nr-drought-workspace-map-card")?.scrollIntoView({ block: "center" }));
    },
  };
}

export function DroughtWorkspaceHeader({ target, archiveLabel, onNavigate }: {
  target: DroughtForecastWorkspaceTarget;
  archiveLabel: string;
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
    <small>คลังพยากรณ์ถึง {archiveLabel} · ข้อมูลพยากรณ์ย้อนหลัง ไม่ใช่สถานการณ์ปัจจุบัน</small>
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
    <AppSelect label="เป้าหมาย" ariaLabel="เดือนเป้าหมาย" icon={<CalendarDays size={20} />} value={selectedMonth}
      compactValue options={monthOptions.map((option) => ({ ...option, triggerLabel: option.label.replace("เป้าหมาย · ", "") }))} onChange={onMonthChange} />
    <div className="nr-fixed-filter"><ShieldCheck size={20} aria-hidden="true" /><span>ภัย<strong>ภัยแล้ง</strong></span></div>
    <div className="nr-fixed-filter"><Sprout size={20} aria-hidden="true" /><span>พืช<strong>ข้าว</strong></span></div>
    <AppSelect className="nr-operational-area-filter" label={isProvince ? "อำเภอ" : "ตำบล"} icon={<MapPin size={20} />}
      value={target.level === "subdistrict" ? target.subdistrict.subdistrictCode : ""} options={areaOptions}
      onChange={(code) => {
        const path = isProvince ? pathForDistrictCode(code) : code ? pathForSubdistrictCode(code) : pathForDistrictCode(target.district.districtCode);
        if (path) onNavigate(path);
      }} />
    <AppSelect className="nr-operational-horizon-filter" label="ระยะพยากรณ์" icon={<TrendingUp size={20} />} value={String(selectedHorizon)}
      options={forecastArchiveHorizonValues.map((horizon) => ({ value: String(horizon), label: `T+${horizon}` }))}
      onChange={(value) => onHorizonChange(Number(value) as ForecastArchiveHorizon)} />
  </section>;
}

export function DroughtOperationalDisclosure({ title, description, icon = "activity", children, className = "" }: {
  title: string;
  description?: string;
  icon?: "activity" | "data" | "crop" | "map";
  children: ReactNode;
  className?: string;
}) {
  const Icon = icon === "data" ? Database : icon === "crop" ? Sprout : icon === "map" ? MapPin : Activity;
  return <details className={`nr-operational-disclosure ${className}`}>
    <summary><Icon size={22} aria-hidden="true" /><span><strong>{title}</strong>{description && <small>{description}</small>}</span><ChevronRight size={18} aria-hidden="true" /></summary>
    <div className="nr-operational-disclosure-body">{children}</div>
  </details>;
}
