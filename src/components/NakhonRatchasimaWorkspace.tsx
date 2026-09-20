import {
  type NakhonRatchasimaRouteTarget,
  getNakhonRatchasimaMapLayers,
  getNakhonRatchasimaDistrictByCode,
  getNakhonRatchasimaResearchPeriods,
  NAKHON_RATCHASIMA_LAYER_IDS,
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
} from "./nakhon-ratchasima/workspaceModel";
import { formatMonth } from "../i18n";
import { useForecastArchive } from "../useForecastArchive";
import { ForecastArchiveRequest } from "./ForecastArchiveRequest";
import { preloadLocalMapGeometry } from "../data/localMapGeometry";
import { PanelTitle } from "./nakhon-ratchasima/SharedPanels";
import { AlertTriangle } from "lucide-react";
import { DroughtWorkspaceLoading } from "./nakhon-ratchasima/ForecastArchiveLoading";
import { ProvinceView } from "./nakhon-ratchasima/ProvinceView";
import { DistrictView } from "./nakhon-ratchasima/DistrictView";
import { SubdistrictView } from "./nakhon-ratchasima/SubdistrictView";
import { ArchiveUnavailableState } from "./ArchiveUnavailableState";

export function NakhonRatchasimaWorkspace(props: { route: NakhonRatchasimaRouteTarget; onNavigate: (path: string) => void }) {
  const horizon = new URLSearchParams(window.location.search).get("horizon");
  // Overview has a T+1-only payload. An explicit different vintage needs the
  // existing six-horizon workspace, never the overview's T+1 substitution.
  const fullOverview = props.route.valid && props.route.level === "province" && props.route.tab === "overview" && horizon && horizon !== "1";
  const district = fullOverview ? getNakhonRatchasimaDistrictByCode(new URLSearchParams(window.location.search).get("district") ?? undefined) : undefined;
  const forecastRoute: NakhonRatchasimaRouteTarget = fullOverview
    ? district ? { valid: true, level: "district", district } : { valid: true, level: "province", tab: "drought" }
    : props.route;
  return horizon && !/^[1-6]$/.test(horizon)
    ? <ArchiveUnavailableState invalidHorizon /> : <ForecastArchiveWorkspace {...props} route={forecastRoute} />;
}

function ForecastArchiveWorkspace({
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

  const isDroughtWorkspaceRoute = route.valid && (route.level !== "province" || route.tab === "drought");
  const areaCode = route.valid && route.level === "subdistrict" ? route.subdistrict.subdistrictCode
    : route.valid && route.level === "district" ? route.district.districtCode : "30";
  const forecastRequest = useForecastArchive(isDroughtWorkspaceRoute, "full", areaCode);
  const { archive: droughtArchive, failed: archiveFailed, retry: retryArchive } = forecastRequest;
  useEffect(() => {
    if (isDroughtWorkspaceRoute) void preloadLocalMapGeometry();
  }, [isDroughtWorkspaceRoute]);

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

  if (isDroughtWorkspaceRoute && forecastRequest.periodUnavailable) return <ArchiveUnavailableState />;
  if (isDroughtWorkspaceRoute && !droughtArchive) {
    return <DroughtWorkspaceLoading target={route} failed={archiveFailed} retry={retryArchive} onNavigate={onNavigate} />;
  }

  return (
    <ForecastArchiveRequest request={forecastRequest}>
    <div className={["page-stack", "nr-workspace", isDroughtWorkspaceRoute ? "is-drought-route" : ""].join(" ")}>
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
    </div>
    </ForecastArchiveRequest>
  );
}
