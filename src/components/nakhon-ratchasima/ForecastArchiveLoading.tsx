import { forecastHorizonLabel } from "../../forecastPeriod";
import { DroughtWorkspaceHeader } from "./DroughtOperationalWorkspace";
import type { DroughtForecastWorkspaceTarget } from "./forecastModel";
import { ForecastLoadState, LoadingChart, LoadingFilters, LoadingMap, LoadingMetrics, Skeleton, type LoadStateProps } from "./ForecastLoadingPrimitives";

export { ForecastOverviewLoading } from "./ForecastLoadingPrimitives";

export function DroughtWorkspaceLoading({ target, failed, retry, onNavigate }: LoadStateProps & {
  target: DroughtForecastWorkspaceTarget; onNavigate: (path: string) => void;
}) {
  const single = target.level === "subdistrict";
  return <div className="page-stack nr-workspace is-drought-route nr-loading-drought">
    <DroughtWorkspaceHeader target={target} onNavigate={onNavigate} />
    <ForecastLoadState failed={failed} retry={retry} message="กำลังโหลดข้อมูลพยากรณ์ภัยแล้ง">
      <LoadingFilters target={target} />
      <div className={`nr-loading-forecast${single ? " is-single" : ""}`}>
        <div className="nr-loading-forecast-heading"><h2>{single ? "พยากรณ์ภัยแล้งรายตำบล" : "เปรียบเทียบพยากรณ์ภัยแล้งล่วงหน้า 6 เดือน"}</h2><Skeleton className="is-line" /></div>
        <div className="nr-loading-horizons">{[1, 2, 3, 4, 5, 6].map((horizon) => <div key={horizon}><strong>{forecastHorizonLabel(horizon, "short")}</strong><Skeleton /></div>)}</div>
        <div className={`nr-loading-context${single ? " is-single" : ""}`}>
          {(single ? ["เดือนตั้งต้น (T)", "เดือนที่พยากรณ์", "พืชที่ประเมิน"] : ["เดือนตั้งต้น (T)", "เดือนที่พยากรณ์", "มีค่าพยากรณ์", "พืชที่ประเมิน"]).map((label) => <div key={label}><small>{label}</small><Skeleton className="is-value" /></div>)}
        </div>
        <LoadingMap />
        {!single && <LoadingChart />}
        <LoadingMetrics className={single ? "is-single" : "is-population"} labels={single ? ["ผลพยากรณ์ภัยแล้งของตำบล"] : ["มีค่าพยากรณ์", "ไม่มีความเสี่ยง", "เสี่ยงปานกลาง", "เสี่ยงสูง", "นอกขอบเขต"]} />
        {single && <div className="nr-loading-guidance"><h3>คำแนะนำและข้อควรระวัง</h3><Skeleton className="is-line" /></div>}
      </div>
    </ForecastLoadState>
  </div>;
}
