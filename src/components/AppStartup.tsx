import { SidebarBrand } from "./SidebarBrand";
import { ForecastOverviewLoading, Skeleton } from "./nakhon-ratchasima/ForecastLoadingPrimitives";
import "../app-startup.css";

/** Presentation only. Never import auth, workspace state, routes or data loaders here. */
export function AppStartup({ path, message }: { path: string; message: string }) {
  const overview = path === "/";
  return <div className={`app-shell app-startup${overview ? " is-home-overview" : ""}`} lang="th">
    <aside className="sidebar" aria-label="โคราชทันภัย">
      <SidebarBrand compactMobileLogo={overview} label="โคราชทันภัย" />
      <div className="app-startup-navigation" aria-hidden="true">
        <Skeleton /><Skeleton /><Skeleton />
      </div>
      <div className="app-startup-mobile-account" aria-hidden="true"><Skeleton className="is-icon" /></div>
    </aside>
    <main className="main-panel">
      <div className="topbar app-startup-topbar" aria-hidden="true">
        <Skeleton className="is-icon" /><Skeleton className="is-value" />
      </div>
      <div className="content-area">
        {overview ? <ForecastOverviewLoading failed={false} retry={() => {}} message={message} /> : <section className="app-startup-workspace">
          <header><p className="eyebrow">โคราชทันภัย</p><h1>กำลังเตรียมพื้นที่ที่เลือก</h1></header>
          <p className="nr-forecast-loading-status" role="status"><span aria-hidden="true" />{message}</p>
          <div className="app-startup-placeholder" aria-busy="true" aria-label="กำลังเตรียมหน้าเว็บ">
            <div aria-hidden="true"><Skeleton className="is-value" /><Skeleton /><Skeleton className="is-line" /></div>
            <div className="app-startup-panels" aria-hidden="true"><Skeleton /><Skeleton /></div>
          </div>
        </section>}
      </div>
    </main>
  </div>;
}
