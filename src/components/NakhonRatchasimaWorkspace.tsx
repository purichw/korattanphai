import {
  type NakhonRatchasimaRouteTarget,
  getNakhonRatchasimaDistrictByCode,
  NAKHON_RATCHASIMA_ROUTE_BASE,
} from "../domain";
import { useEffect } from "react";
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
          onNavigate={onNavigate}
        />
      )}
      {route.level === "district" && droughtArchive && (
        <DistrictView
          droughtArchive={droughtArchive}
          district={route.district}
          onNavigate={onNavigate}
        />
      )}
      {route.level === "subdistrict" && droughtArchive && (
        <SubdistrictView
          droughtArchive={droughtArchive}
          district={route.district}
          subdistrict={route.subdistrict}
          onNavigate={onNavigate}
        />
      )}
    </div>
    </ForecastArchiveRequest>
  );
}
