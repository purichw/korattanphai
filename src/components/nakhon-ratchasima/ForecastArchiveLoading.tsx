import type { ReactNode } from "react";
import { CalendarDays, ChartColumn, CircleAlert, Leaf, Map, MapPin, RotateCcw, ShieldCheck, TrendingUp } from "lucide-react";
import { MetricGrid } from "../PageSummary";
import { DroughtWorkspaceHeader } from "./DroughtOperationalWorkspace";
import type { DroughtForecastWorkspaceTarget } from "./forecastModel";
import "../../forecast-loading.css";

type LoadStateProps = { failed: boolean; retry: () => void };

function Skeleton({ className = "" }: { className?: string }) {
  return <span className={`nr-skeleton ${className}`} aria-hidden="true" />;
}

function ForecastLoadState({ failed, retry, message, children }: LoadStateProps & { message: string; children: ReactNode }) {
  return <div className={`nr-forecast-load-state${failed ? " is-failed" : ""}`}>
    {failed ? <section className="nr-forecast-load-error">
      <CircleAlert size={24} aria-hidden="true" />
      <div><p role="alert">โหลดข้อมูลพยากรณ์ไม่สำเร็จ กรุณาลองใหม่</p><small>ยังแสดงผลพยากรณ์ไม่ได้ในขณะนี้</small></div>
      <button className="secondary-button" type="button" onClick={retry}><RotateCcw size={16} aria-hidden="true" />ลองใหม่</button>
    </section> : <>
      <p className="nr-forecast-loading-status" role="status"><span aria-hidden="true" />{message}</p>
      <div className="nr-forecast-loading-content" aria-busy="true" aria-label="ข้อมูลพยากรณ์กำลังโหลด">
        <div aria-hidden="true">{children}</div>
      </div>
    </>}
  </div>;
}

function LoadingField({ label, value, icon }: { label: string; value?: string; icon: ReactNode }) {
  return <div className="nr-loading-field">{icon}<span><small>{label}</small>{value ? <strong>{value}</strong> : <Skeleton className="is-value" />}</span></div>;
}

function LoadingFilters({ overview = false, target }: { overview?: boolean; target?: DroughtForecastWorkspaceTarget }) {
  const area = !target ? undefined : target.level === "province" ? "ทุกอำเภอ" : target.level === "district" ? "ทุกตำบล" : target.subdistrict.nameTh;
  return <div className={`nr-loading-filters${overview ? " is-overview" : ""}`}>
    {overview && <div className="nr-loading-filter-heading">ตัวกรองข้อมูล</div>}
    <LoadingField label="เดือนตั้งต้น" icon={<CalendarDays size={20} />} />
    <LoadingField label="ภัย" value="ภัยแล้ง" icon={<ShieldCheck size={20} />} />
    <LoadingField label="พืช" value="ข้าว" icon={<Leaf size={20} />} />
    <LoadingField label={!target || target.level === "province" ? "อำเภอ" : "ตำบล"} value={area} icon={<MapPin size={20} />} />
    <div className="nr-loading-horizon-field"><LoadingField label="ระยะพยากรณ์" value={overview ? "T+1" : undefined} icon={<TrendingUp size={20} />} /></div>
  </div>;
}

function LoadingMetrics({ labels, className = "" }: { labels: string[]; className?: string }) {
  return <MetricGrid className={`nr-loading-metrics ${className}`} metrics={labels.map((label) => ({
    label, value: <Skeleton className="is-number" />, icon: <Skeleton className="is-icon" />, tone: "muted",
  }))} />;
}

function LoadingMap() {
  return <div className="nr-loading-map">
    <h3>แผนที่พยากรณ์ความเสี่ยงภัยแล้ง</h3>
    <div className="nr-loading-map-toolbar"><Skeleton /><Skeleton /></div>
    <div className="nr-loading-map-surface"><Map size={36} strokeWidth={1.25} aria-hidden="true" /></div>
    <div className="nr-loading-map-legend"><Skeleton /><Skeleton /><Skeleton /></div>
  </div>;
}

function LoadingChart() {
  return <div className="nr-loading-chart">
    <h3>ตำบลเสี่ยงในแต่ละเดือน แยกตามระดับ</h3>
    <div className="nr-loading-chart-modes"><Skeleton /><Skeleton /></div>
    <div className="nr-loading-chart-surface"><ChartColumn size={32} strokeWidth={1.25} aria-hidden="true" /></div>
    <Skeleton className="is-line" />
  </div>;
}

export function ForecastOverviewLoading({ failed, retry }: LoadStateProps) {
  return <section className="nr-forecast-overview nr-loading-overview" aria-label="ภาพรวมพยากรณ์ภัยแล้ง">
    <header className="nr-forecast-overview-heading nr-dashboard-heading">
      <div><p className="eyebrow">ภาพรวมสถานการณ์</p><h1>จังหวัดนครราชสีมา</h1><p>ภาพรวมพยากรณ์ภัยแล้ง</p></div>
      <p>คลังพยากรณ์ย้อนหลัง · ไม่ใช่ข้อมูลสด</p>
    </header>
    <ForecastLoadState failed={failed} retry={retry} message="กำลังโหลดภาพรวมพยากรณ์ภัยแล้ง">
      <LoadingFilters overview />
      <div className="nr-loading-situation"><LoadingMetrics labels={["ผลพยากรณ์ภัยแล้ง", "พืชที่ประเมิน"]} /></div>
      <div className="nr-loading-overview-grid">
        <LoadingMap />
        <div className="nr-loading-summary"><h3>สรุปพยากรณ์พื้นที่ที่เลือก</h3><Skeleton className="is-line" />
          <LoadingMetrics labels={["เสี่ยงสูง", "เสี่ยงปานกลาง", "ไม่มีความเสี่ยง", "นอกขอบเขต"]} />
        </div>
        <div className="nr-loading-attention"><h3>ตำบลที่พยากรณ์เสี่ยงสูง</h3>
          {[1, 2, 3].map((row) => <div className="nr-loading-list-row" key={row}><Skeleton className="is-icon" /><span><Skeleton /><Skeleton className="is-line" /></span></div>)}
        </div>
      </div>
    </ForecastLoadState>
  </section>;
}

export function DroughtWorkspaceLoading({ target, failed, retry, onNavigate }: LoadStateProps & {
  target: DroughtForecastWorkspaceTarget; onNavigate: (path: string) => void;
}) {
  const single = target.level === "subdistrict";
  return <div className="page-stack nr-workspace is-drought-route nr-loading-drought">
    <DroughtWorkspaceHeader target={target} onNavigate={onNavigate} />
    <ForecastLoadState failed={failed} retry={retry} message="กำลังโหลดข้อมูลพยากรณ์ภัยแล้ง">
      <LoadingFilters target={target} />
      <div className={`nr-loading-forecast${single ? " is-single" : ""}`}>
        <div className="nr-loading-forecast-heading"><h2>{single ? "พยากรณ์ภัยแล้งรายตำบล" : "เปรียบเทียบพยากรณ์ภัยแล้ง T+1 ถึง T+6"}</h2><Skeleton className="is-line" /></div>
        <div className="nr-loading-horizons">{[1, 2, 3, 4, 5, 6].map((horizon) => <div key={horizon}><strong>T+{horizon}</strong><Skeleton /></div>)}</div>
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
