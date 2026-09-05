import {
  type NakhonRatchasimaRouteTarget,
  getNakhonRatchasimaMapLayers,
  getNakhonRatchasimaResearchPeriods,
  NAKHON_RATCHASIMA_LAYER_IDS,
  getNakhonRatchasimaResearchPanelSummary,
  NAKHON_RATCHASIMA_ROUTE_BASE,
} from "../domain";
import { useAppState, useAppDispatch } from "../store";
import { useMemo, useState, useEffect } from "react";
import {
  hiddenLocalHydrologyLayerIds,
  localResearchPendingLabel,
  buddhistYearGroupForPeriod,
  dashboardDefaultsForTab,
  type LocalMapMode,
  pathForDistrictCode,
  pathForSubdistrictCode,
  districtOptionsForProvince,
  subdistrictOptionsForRoute,
  routeBackTargetForRoute,
  researchLatestPeriod,
  formatThaiNumber,
} from "./nakhon-ratchasima/workspaceModel";
import { formatMonth } from "../i18n";
import { useForecastArchive } from "../useForecastArchive";
import { preloadLocalMapGeometry } from "../data/localMapGeometry";
import { PanelTitle } from "./nakhon-ratchasima/SharedPanels";
import { AlertTriangle, ArrowLeft, RotateCcw } from "lucide-react";
import { DroughtPageHeader } from "./nakhon-ratchasima/DroughtForecastWorkspace";
import { NakhonRatchasimaBreadcrumbs, SourceFreshness } from "./nakhon-ratchasima/ResearchPanels";
import { OperationalFilters } from "./OperationalFilters";
import { ProvinceView } from "./nakhon-ratchasima/ProvinceView";
import { DistrictView } from "./nakhon-ratchasima/DistrictView";
import { SubdistrictView } from "./nakhon-ratchasima/SubdistrictView";

export function NakhonRatchasimaWorkspace({
  route,
  onNavigate,
}: {
  route: NakhonRatchasimaRouteTarget;
  onNavigate: (path: string) => void;
}) {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const layers = getNakhonRatchasimaMapLayers();
  const visibleLayers = useMemo(
    () => layers.filter((layer) => !hiddenLocalHydrologyLayerIds.has(layer.id)),
    [layers],
  );
  const hasScopedDataGovernanceSection =
    route.valid && (route.level === "district" || route.level === "subdistrict" || (route.level === "province" && route.tab === "drought"));
  const researchPeriods = useMemo(() => getNakhonRatchasimaResearchPeriods(), []);
  const [workspaceMonth, setWorkspaceMonth] = useState(() =>
    researchPeriods.includes(state.selectedMonth) ? state.selectedMonth : (researchPeriods[researchPeriods.length - 1] ?? state.selectedMonth),
  );
  const researchMonthOptions = useMemo(() => {
    const periods = researchPeriods.slice().reverse();
    if (periods.length === 0) {
      return [
        {
          value: workspaceMonth,
          label: localResearchPendingLabel,
          group: "สถานะข้อมูล",
          badge: "ไม่มีข้อมูลแผนที่",
          badgeTone: "watch" as const,
          disabled: true,
        },
      ];
    }
    const options = periods.map((period) => ({
      value: period,
      label: formatMonth(period, "th"),
      group: buddhistYearGroupForPeriod(period),
    }));
    if (periods.includes(workspaceMonth)) return options;
    return [
      {
        value: workspaceMonth,
        label: `${formatMonth(workspaceMonth, "th")} · ไม่มีข้อมูลในรอบนี้`,
        group: "เดือนที่เลือกอยู่",
        badge: "ใช้เดือนล่าสุดแทน",
        badgeTone: "watch" as const,
      },
      ...options,
    ];
  }, [researchPeriods, workspaceMonth]);
  const handleWorkspaceMonthChange = (month: string) => {
    setWorkspaceMonth(month);
    dispatch({ type: "setMonth", month });
  };
  const initialDashboardDefaults =
    route.valid && route.level === "province"
      ? dashboardDefaultsForTab(route.tab)
      : {
          layerId: NAKHON_RATCHASIMA_LAYER_IDS.derivedAgriculturalRisk,
          mapMode: "prediction-readiness" as LocalMapMode,
        };
  const [selectedLayerId, setSelectedLayerId] = useState(initialDashboardDefaults.layerId);
  const [mapMode, setMapMode] = useState<LocalMapMode>(initialDashboardDefaults.mapMode);
  const selectedLayer = visibleLayers.find((layer) => layer.id === selectedLayerId) ?? visibleLayers[0] ?? layers[0];

  const provinceRouteTab = route.valid && route.level === "province" ? route.tab : null;
  useEffect(() => {
    if (!provinceRouteTab) return;
    const nextDefaults = dashboardDefaultsForTab(provinceRouteTab);
    setSelectedLayerId(nextDefaults.layerId);
    setMapMode(nextDefaults.mapMode);
  }, [provinceRouteTab]);

  const selectDistrictFromFilter = (districtCode: string) => {
    const path = pathForDistrictCode(districtCode);
    if (path) onNavigate(path);
  };
  const selectSubdistrictFromFilter = (subdistrictCode: string) => {
    const path = pathForSubdistrictCode(subdistrictCode);
    if (path) onNavigate(path);
  };
  const areaFilterConfig =
    !route.valid || route.level === "subdistrict"
      ? null
      : route.level === "province"
        ? {
            label: "อำเภอ",
            value: "",
            options: districtOptionsForProvince(),
            placeholder: "ทุกอำเภอ",
            onChange: selectDistrictFromFilter,
          }
        : {
            label: "ตำบล",
            value: "",
            options: subdistrictOptionsForRoute(route, selectedLayer, mapMode),
            placeholder: "ทุกตำบล",
            onChange: selectSubdistrictFromFilter,
          };
  const routeBackTarget = routeBackTargetForRoute(route);
  const handleRouteBack = () => {
    if (routeBackTarget) onNavigate(routeBackTarget.path);
  };
  const isProvinceDroughtRoute = route.level === "province" && route.tab === "drought";
  const isDroughtWorkspaceRoute = route.valid && (route.level !== "province" || route.tab === "drought");
  const { archive: droughtArchive, failed: archiveFailed, retry: retryArchive } = useForecastArchive(isDroughtWorkspaceRoute);
  useEffect(() => {
    if (isDroughtWorkspaceRoute) void preloadLocalMapGeometry();
  }, [isDroughtWorkspaceRoute]);
  const droughtPageArchive = isProvinceDroughtRoute ? droughtArchive : null;
  const droughtPageResearch = isProvinceDroughtRoute ? getNakhonRatchasimaResearchPanelSummary() : null;
  const showMobileProvinceOverviewIdentity = route.valid && route.level === "province" && route.tab === "overview";
  const operationalFilterContextChips =
    route.valid && route.level === "subdistrict"
      ? [{ label: "ตำบล", value: route.subdistrict.nameTh ?? route.subdistrict.name }]
      : [];
  const operationalFilterQuickFacts = (() => {
    if (!route.valid) return [];
    const research = getNakhonRatchasimaResearchPanelSummary();
    const latestPeriod = researchLatestPeriod(research);
    if (route.level === "province") {
      return [
        { label: "อำเภอ", value: `${formatThaiNumber(research.meta.districtCount)} อำเภอ` },
        { label: "ตำบล", value: `${formatThaiNumber(research.meta.subdistrictCount)} ตำบล` },
        { label: "อัปเดตล่าสุด", value: latestPeriod },
      ];
    }
    if (route.level === "district") {
      return [
        { label: "พื้นที่", value: `${formatThaiNumber(route.district.subdistricts.length)} ตำบล` },
        { label: "อำเภอ", value: route.district.nameTh ?? route.district.name },
        { label: "อัปเดตล่าสุด", value: latestPeriod },
      ];
    }
    return [
      { label: "รหัสตำบล", value: route.subdistrict.subdistrictCode ?? route.subdistrict.id },
      { label: "อำเภอ", value: route.district.nameTh ?? route.district.name },
      { label: "อัปเดตล่าสุด", value: latestPeriod },
    ];
  })();

  if (!route.valid) {
    return (
      <div className="page-stack nr-workspace">
        <section className="nr-panel">
          <PanelTitle icon={<AlertTriangle size={18} />} title="ไม่พบพื้นที่" />
          <p>ที่อยู่เว็บนี้ไม่ตรงกับอำเภอหรือตำบลในจังหวัดนครราชสีมา กรุณากลับไปภาพรวมจังหวัด</p>
          <button type="button" className="primary-button" onClick={() => onNavigate(NAKHON_RATCHASIMA_ROUTE_BASE)}>
            กลับภาพรวม
          </button>
        </section>
      </div>
    );
  }

  if (isDroughtWorkspaceRoute && !droughtArchive) {
    return (
      <div className="page-stack nr-workspace">
        <section className="nr-route-bar">
          <button type="button" className="secondary-button" onClick={() => onNavigate(NAKHON_RATCHASIMA_ROUTE_BASE)}>
            <ArrowLeft size={16} /> กลับภาพรวม
          </button>
        </section>
        <section className="nr-archive-load-state" aria-busy={!archiveFailed}>
          <p role={archiveFailed ? "alert" : "status"}>
            {archiveFailed ? "โหลดข้อมูลพยากรณ์ไม่สำเร็จ กรุณาลองใหม่" : "กำลังโหลดข้อมูลพยากรณ์ภัยแล้ง"}
          </p>
          {archiveFailed && (
            <button type="button" className="secondary-button" onClick={retryArchive}>
              <RotateCcw size={16} /> ลองใหม่
            </button>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className={["page-stack", "nr-workspace", isDroughtWorkspaceRoute ? "is-drought-route" : ""].join(" ")}>
      {isProvinceDroughtRoute && droughtPageArchive && droughtPageResearch ? (
        <DroughtPageHeader archive={droughtPageArchive} research={droughtPageResearch} onBack={handleRouteBack} />
      ) : !showMobileProvinceOverviewIdentity ? (
        <section className={["nr-route-bar", showMobileProvinceOverviewIdentity ? "is-mobile-redundant-province-route" : ""].join(" ")}>
          {routeBackTarget && (
            <div className="nr-route-actions">
              <button type="button" className="secondary-button" onClick={handleRouteBack}>
                <ArrowLeft size={16} />
                {routeBackTarget.label}
              </button>
            </div>
          )}
          <NakhonRatchasimaBreadcrumbs target={route} onNavigate={onNavigate} />
        </section>
      ) : null}

      {showMobileProvinceOverviewIdentity && (
        <section className="nr-mobile-page-identity" aria-labelledby="nr-mobile-province-title">
          <p className="eyebrow">ภาพรวมจังหวัด</p>
          <h1 id="nr-mobile-province-title">จังหวัดนครราชสีมา</h1>
          <p>ภาพรวมพยากรณ์ภัยแล้ง</p>
        </section>
      )}

      {!showMobileProvinceOverviewIdentity && <OperationalFilters
        monthOptions={route.valid ? researchMonthOptions : undefined}
        monthValue={route.valid ? workspaceMonth : undefined}
        onMonthChange={route.valid ? handleWorkspaceMonthChange : undefined}
        areaLabel={areaFilterConfig?.label}
        areaValue={areaFilterConfig?.value}
        areaOptions={areaFilterConfig?.options}
        areaPlaceholder={areaFilterConfig?.placeholder}
        onAreaChange={areaFilterConfig?.onChange}
        contextChips={operationalFilterContextChips}
        quickFacts={operationalFilterQuickFacts}
        ariaLabel="ตัวกรองข้อมูลพื้นที่นครราชสีมา"
        className={isDroughtWorkspaceRoute ? "is-drought-workspace-filter" : undefined}
      />}

      {route.level === "province" && (
        <ProvinceView
          droughtArchive={droughtArchive}
          activeTab={route.tab}
          layer={selectedLayer}
          mapMode={mapMode}
          onMapModeChange={setMapMode}
          onNavigate={onNavigate}
          selectedMonth={workspaceMonth}
          monthOptions={researchMonthOptions}
          onMonthChange={handleWorkspaceMonthChange}
        />
      )}
      {route.level === "district" && droughtArchive && (
        <DistrictView
          droughtArchive={droughtArchive}
          district={route.district}
          layer={selectedLayer}
          mapMode={mapMode}
          onMapModeChange={setMapMode}
          onNavigate={onNavigate}
          selectedMonth={workspaceMonth}
          monthOptions={researchMonthOptions}
          onMonthChange={handleWorkspaceMonthChange}
        />
      )}
      {route.level === "subdistrict" && droughtArchive && (
        <SubdistrictView
          droughtArchive={droughtArchive}
          district={route.district}
          subdistrict={route.subdistrict}
          layer={selectedLayer}
          mapMode={mapMode}
          onMapModeChange={setMapMode}
          onNavigate={onNavigate}
          selectedMonth={workspaceMonth}
          monthOptions={researchMonthOptions}
          onMonthChange={handleWorkspaceMonthChange}
        />
      )}

      {!hasScopedDataGovernanceSection && !showMobileProvinceOverviewIdentity && <SourceFreshness />}
    </div>
  );
}
