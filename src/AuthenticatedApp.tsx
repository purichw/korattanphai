import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { DatabaseWorkspaceProvider } from "./DatabaseWorkspaceProvider";
import { WorkspaceBookmarks } from "./components/WorkspaceBookmarks";
import { ForecastExcelExport } from "./components/ForecastExcelExport";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  CloudRain,
  Database,
  Leaf,
  LogOut,
  Map,
  Menu,
  RotateCcw,
  Send,
  ShieldCheck,
  Sprout,
  UserRound,
  UsersRound,
  Waves,
  X,
} from "lucide-react";
import { getAccountDisplayName, type LoginUser } from "./auth";
import { DataProvenanceChip, DataProvenanceLegend, dataProvenanceChipKindFromText } from "./components/DataProvenanceChip";
import { NakhonRatchasimaWorkspaceSummary } from "./components/NakhonRatchasimaWorkspaceSummary";
import { NakhonRatchasimaWorkspace } from "./components/NakhonRatchasimaWorkspace";
import { OperationalFilters, provinceOptionsForMonth } from "./components/OperationalFilters";
import { MetricCard, PageSummary } from "./components/PageSummary";
import { ProvinceWorkspacePlaceholder } from "./components/ProvinceWorkspacePlaceholder";
import { RiskMap } from "./components/RiskMap";
import {
  advisory,
  cropProfiles,
  dataModelRegistry,
  farmerProfile,
  fieldTasks,
  mapLayerCatalog,
  nationalMonthlyBackbone,
  outcomeAnalytics,
  provinces,
  sourceRegistry,
  users,
} from "./data/catalog";
import {
  FARM_ID,
  formatRai,
  getActionQueue,
  getEventAuditTrail,
  getEventEnrichment,
  getFarmerVisibleAlerts,
  getFilteredEvents,
  getFilteredProvinceRecords,
  getLayerAvailability,
  getLayerSources,
  getMapLayer,
  getOutcomeForEvent,
  getNakhonRatchasimaProvinceTabPath,
  getProvinceRecord,
  getProvinceTrend,
  getProvinceWorkspacePath,
  getRuntimeEvent,
  getTask,
  getTaskStatus,
  getTopRisks,
  isWorkspaceAppRoute,
  MAIN_ADVISORY_ID,
  MAIN_EVENT_ID,
  MAIN_TASK_ID,
  NAKHON_RATCHASIMA_ID,
  monthContext,
  resolveAppRoute,
  severityTone,
  summarizeNationalRecords,
} from "./domain";
import {
  formatMonth,
  formatAuditTime,
  labelAdvisoryAction,
  labelAdvisorySummary,
  labelAdvisoryTitle,
  labelActionRole,
  labelAuditAction,
  labelBackboneLabel,
  labelChannel,
  labelConfidence,
  labelCrop,
  labelCropAction,
  labelCropCondition,
  labelCropOutlook,
  labelCropPresenceRule,
  labelCropStageSummary,
  labelDataMode,
  labelDriverLabel,
  labelDriverValue,
  labelEvidenceKey,
  labelEvidenceValue,
  labelEventSummary,
  labelEventTitle,
  labelFarmName,
  labelFarmerCropStage,
  labelFieldChecklist,
  labelFieldObservation,
  labelHazard,
  labelImpact,
  labelLayerAvailability,
  labelLayerGroup,
  labelLocationName,
  labelModelCoverage,
  labelModelFamily,
  labelModelFreshness,
  labelModelLimitations,
  labelModelName,
  labelModelProvenance,
  labelModelVersion,
  labelMonthNarrative,
  labelOrganization,
  labelOutcomeProvenance,
  labelPeriod,
  labelPersonaRole,
  labelPriority,
  labelPrototypeUse,
  labelProvinceProvenance,
  labelProvenance,
  labelRecommendation,
  labelRegion,
  labelSource,
  labelSourceType,
  labelSourceName,
  labelStatus,
  labelWorkflowStep,
  severityLabel,
  t,
} from "./i18n";
import { loadRiskFusionBreakdown } from "./riskFusionClient";
import { AppStateProvider, useAppDispatch, useAppState } from "./store";
import type { AppSection, Language, RiskFusionBreakdown, UserPersona, VerificationSubmission } from "./types";

const sectionIcons: Record<AppSection, typeof Map> = {
  overview: BarChart3,
  risks: AlertTriangle,
  map: Map,
  forecast: CloudRain,
  crops: Sprout,
  workflows: ClipboardCheck,
  alerts: Bell,
  planning: Waves,
  models: Database,
};

const sections: AppSection[] = [
  "overview",
  "risks",
  "map",
  "forecast",
  "crops",
  "workflows",
  "alerts",
  "planning",
  "models",
];

const publicationChannels = [
  "Web portal",
  "Farmer app",
  "Push",
  "SMS",
  "Email",
  "LINE-like channel",
  "PDF bulletin",
  "Voice / IVR",
];

const accountPersonaOptions = users.filter((user) => user.id !== "u-water");

function AccountControl({
  loginUser,
  persona,
  language,
  compact = false,
  demoActions = false,
  onPersonaChange,
  onResetDemo,
  onLogout,
  signingOut,
}: {
  loginUser: LoginUser;
  persona: UserPersona;
  language: Language;
  compact?: boolean;
  demoActions?: boolean;
  onPersonaChange: (personaId: string) => void;
  onResetDemo: () => void;
  onLogout: () => void;
  signingOut: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuId = useId().replaceAll(":", "");
  const roleLabel = labelPersonaRole(persona.role, language);
  const accountDisplayName = getAccountDisplayName(loginUser);
  const accountLabel = `บัญชีผู้ใช้ ${accountDisplayName}`;

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const closeMenu = () => {
    setIsOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const choosePersona = (personaId: string) => {
    onPersonaChange(personaId);
    closeMenu();
  };

  return (
    <div ref={rootRef} className={compact ? "account-menu is-compact" : "account-menu"}>
      <button
        ref={triggerRef}
        type="button"
        className="account-trigger"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        aria-label={accountLabel}
        title={compact ? accountLabel : undefined}
        onClick={() => setIsOpen((open) => !open)}
      >
        <UserRound size={18} aria-hidden="true" />
        <span className="account-trigger-copy">
          <strong>{accountDisplayName}</strong>
          <small>{demoActions ? `มุมมอง: ${roleLabel}` : "บัญชีผู้ใช้"}</small>
        </span>
        <ChevronDown className="account-trigger-chevron" size={17} aria-hidden="true" />
      </button>
      {isOpen && (
        <>
          <div
            className="account-menu-backdrop"
            aria-hidden="true"
            onPointerDown={(event) => {
              event.preventDefault();
              closeMenu();
            }}
          />
          <div id={menuId} className="account-menu-popover" role="menu" aria-label="บัญชีผู้ใช้">
            <div className="account-menu-heading" role="presentation">
              <span>บัญชีผู้ใช้</span>
            </div>
            <div className="account-menu-profile" role="presentation">
              <UserRound size={18} aria-hidden="true" />
              <span>
                <strong>{accountDisplayName}</strong>
                <small>{loginUser.email}</small>
              </span>
            </div>
            <div className="account-menu-divider" role="presentation" />
            {demoActions && <><div className="account-menu-section" role="presentation">
              <span className="account-menu-section-label">มุมมองการแสดงผล</span>
              <div className="account-role-options" role="group" aria-label="มุมมองการแสดงผล">
                {accountPersonaOptions.map((user) => {
                  const optionRole = labelPersonaRole(user.role, language);
                  const isSelected = user.id === persona.id;
                  return (
                    <button
                      key={user.id}
                      type="button"
                      className={isSelected ? "account-role-option active" : "account-role-option"}
                      role="menuitemradio"
                      aria-checked={isSelected}
                      onClick={() => choosePersona(user.id)}
                    >
                      <UsersRound size={16} aria-hidden="true" />
                      <span>
                        <strong>{optionRole}</strong>
                      </span>
                      {isSelected && <CheckCircle2 size={16} aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="account-menu-divider" role="presentation" />
            <button
              type="button"
              className="account-menu-action is-warning"
              role="menuitem"
              onClick={() => {
                onResetDemo();
                closeMenu();
              }}
            >
              <RotateCcw size={16} aria-hidden="true" />
              <span>{t("resetDemo", language)}</span>
            </button></>}
            <button
              type="button"
              className="account-menu-action is-danger"
              role="menuitem"
              disabled={signingOut}
              onClick={onLogout}
            >
              <LogOut size={16} aria-hidden="true" />
              <span>{signingOut ? "กำลังออกจากระบบ..." : "ออกจากระบบ"}</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function AuthenticatedApp(props: {
  loginUser: LoginUser;
  onLogout: () => void;
  signingOut: boolean;
  path: string;
  onNavigate: (path: string) => void;
}) {
  useEffect(() => {
    if (isWorkspaceAppRoute(props.path)) window.scrollTo(0, 0);
  }, [props.path]);
  const app = <AppStateProvider><AppShell {...props} /></AppStateProvider>;
  return import.meta.env.VITE_DATA_BACKEND === "supabase"
    ? <DatabaseWorkspaceProvider key={props.loginUser.id} userId={props.loginUser.id}>{app}</DatabaseWorkspaceProvider>
    : app;
}

function AppShell({
  loginUser,
  onLogout,
  signingOut,
  path,
  onNavigate,
}: {
  loginUser: LoginUser;
  onLogout: () => void;
  signingOut: boolean;
  path: string;
  onNavigate: (path: string) => void;
}) {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const language = state.language;
  const persona = accountPersonaOptions.find((user) => user.id === state.personaId) ?? accountPersonaOptions[0] ?? users[0];
  const selectedRecord = getProvinceRecord(state.selectedProvinceId, state.selectedMonth);
  const selectedProvince = provinces.find((province) => province.id === state.selectedProvinceId);
  const visibleSections: AppSection[] = ["overview"];
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [savedSelectionVersion, setSavedSelectionVersion] = useState(0);
  const restoreSavedWorkspace = (destination: string) => {
    setSavedSelectionVersion((version) => version + 1);
    onNavigate(destination);
  };
  const appRoute = resolveAppRoute(path);
  const nakhonRoute = appRoute.kind === "nakhon-ratchasima" ? appRoute.target : null;
  const provinceRoute = appRoute.kind === "province-workspace" ? appRoute.target : null;
  const isDroughtSubNavActive = Boolean(
    nakhonRoute?.valid && (nakhonRoute.level !== "province" || nakhonRoute.tab === "drought"),
  );
  const isHomeOverview = Boolean(nakhonRoute?.valid && nakhonRoute.level === "province" && nakhonRoute.tab === "overview");

  const sectionLabel = (section: AppSection) => t(section, language);

  return (
    <div className={`app-shell${isDroughtSubNavActive ? " is-operational-drought" : ""}${isHomeOverview ? " is-home-overview" : ""}`} lang={language}>
      <a className="skip-link" href="#workspace-content" onClick={(event) => {
        event.preventDefault();
        document.getElementById('workspace-content')?.focus();
      }}>ข้ามไปเนื้อหาหลัก</a>
      <aside className={isMobileMenuOpen ? "sidebar mobile-menu-open" : "sidebar"} aria-label="เมนูหลัก">
        <div className="brand-lockup is-logo-only">
          <div className="brand-mark is-sidebar-logo">
            <picture>
              <source media="(max-width: 720px)" srcSet={isDroughtSubNavActive || isHomeOverview ? "/brand/korat-tan-phai-sidebar-logo.webp" : "/brand/korat-tan-phai-emblem.webp"} />
              <img
                src="/brand/korat-tan-phai-sidebar-logo.webp"
                width="640"
                height="585"
                alt={t("brand", language)}
                decoding="async"
              />
            </picture>
          </div>
        </div>
        <button
          type="button"
          className="mobile-menu-toggle"
          aria-expanded={isMobileMenuOpen}
          aria-controls="primary-navigation"
          aria-label={isMobileMenuOpen ? "ปิดเมนูหลัก" : "เปิดเมนูหลัก"}
          onClick={() => setIsMobileMenuOpen((isOpen) => !isOpen)}
        >
          {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <div className="mobile-account-slot">
          <WorkspaceBookmarks onNavigate={restoreSavedWorkspace} />
          <AccountControl
            compact
            loginUser={loginUser}
            persona={persona}
            language={language}
            onPersonaChange={(personaId) => dispatch({ type: "setPersona", personaId })}
            onResetDemo={() => dispatch({ type: "resetDemo" })}
            onLogout={onLogout}
            signingOut={signingOut}
          />
        </div>
        <nav id="primary-navigation" className="primary-nav">
          {visibleSections.map((section) => {
            const Icon = sectionIcons[section];
            const isOverviewSection = section === "overview";
            const isMainItemActive = state.section === section && !(isOverviewSection && isDroughtSubNavActive);
            return (
              <div key={section} className="nav-group">
                <button
                  type="button"
                  className={isMainItemActive ? "nav-item active" : "nav-item"}
                  aria-current={isMainItemActive ? 'page' : undefined}
                  onClick={() => {
                    onNavigate("/");
                    dispatch({ type: "setSection", section });
                    setIsMobileMenuOpen(false);
                  }}
                >
                  <Icon size={17} />
                  <span>{sectionLabel(section)}</span>
                </button>
                {isOverviewSection && (
                  <div className="nav-subnav" aria-label="เมนูย่อยภาพรวม">
                    <button
                      type="button"
                      className={isDroughtSubNavActive ? "nav-subitem active" : "nav-subitem"}
                      aria-current={isDroughtSubNavActive ? 'page' : undefined}
                      onClick={() => {
                        onNavigate(getNakhonRatchasimaProvinceTabPath("drought"));
                        dispatch({ type: "setSection", section });
                        setIsMobileMenuOpen(false);
                      }}
                    >
                      <span>ภัยแล้ง</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          <ForecastExcelExport onOpen={() => setIsMobileMenuOpen(false)} />
        </nav>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-brand">
            <h1 className="sr-only">{t("brand", language)}</h1>
          </div>
          <div className="topbar-actions">
            <WorkspaceBookmarks onNavigate={restoreSavedWorkspace} />
            <AccountControl
              loginUser={loginUser}
              persona={persona}
              language={language}
              onPersonaChange={(personaId) => dispatch({ type: "setPersona", personaId })}
              onResetDemo={() => dispatch({ type: "resetDemo" })}
              onLogout={onLogout}
              signingOut={signingOut}
            />
          </div>
        </header>

        {!appRoute.isWorkspace && (
          <OperationalFilters
            areaLabel={t("province", language)}
            areaValue={state.selectedProvinceId}
            areaOptions={provinceOptionsForMonth(state.selectedMonth)}
            onAreaChange={(provinceId) => dispatch({ type: "selectProvince", provinceId })}
            contextChips={[
              { label: t("asOf", language), value: "25 ส.ค. 2569" },
              { label: "พื้นที่", value: selectedRecord?.provinceTh ?? selectedProvince?.nameTh ?? "" },
            ]}
          />
        )}

        {state.toast && (
          <button type="button" className="toast" onClick={() => dispatch({ type: "toast" })}>
            {state.toast}
          </button>
        )}

        <div className="content-area" id="workspace-content" tabIndex={-1} onClick={(event) => {
          if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          const anchor = (event.target as Element).closest<HTMLAnchorElement>("a[href]");
          if (!anchor || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return;
          const url = new URL(anchor.href);
          if (url.origin !== window.location.origin || (url.pathname === path && url.search === window.location.search)) return;
          event.preventDefault();
          onNavigate(url.pathname + url.search + url.hash);
        }}>
          <AppErrorBoundary resetKey={`${path}:${state.section}:${state.personaId}`}>
          {nakhonRoute ? (
            <NakhonRatchasimaWorkspace key={savedSelectionVersion} route={nakhonRoute} onNavigate={onNavigate} />
          ) : provinceRoute ? (
            <ProvinceWorkspacePlaceholder route={provinceRoute} onNavigate={onNavigate} />
          ) : persona.role === "Farmer" ? (
            <FarmerExperience />
          ) : (
            <OfficerSection onNavigate={onNavigate} />
          )}
          </AppErrorBoundary>
        </div>
      </main>
    </div>
  );
}

function OfficerSection({ onNavigate }: { onNavigate: (path: string) => void }) {
  const state = useAppState();
  switch (state.section) {
    case "overview":
      return <OverviewSection onNavigate={onNavigate} />;
    case "risks":
      return <RisksSection />;
    case "map":
      return <MapSection onNavigate={onNavigate} />;
    case "forecast":
      return <ForecastSection />;
    case "crops":
      return <CropsSection />;
    case "workflows":
      return <WorkflowSection />;
    case "alerts":
      return <AlertsSection />;
    case "planning":
      return <PlanningAnalyticsSection />;
    case "models":
      return <DataModelsSection />;
    default:
      return <OverviewSection onNavigate={onNavigate} />;
  }
}

function OverviewSection({ onNavigate }: { onNavigate: (path: string) => void }) {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const language = state.language;
  const records = getFilteredProvinceRecords(state);
  const summary = summarizeNationalRecords(records);
  const topRisks = getTopRisks(state);
  const queue = getActionQueue(state);
  const context = monthContext(state.selectedMonth);

  return (
    <div className="page-grid overview-grid">
      <PageSummary
        eyebrow="ภาพรวมประเทศ"
        title="อะไรต้องลงมือก่อน ที่ไหน และกระทบพืชอะไร"
        description={labelMonthNarrative(state.selectedMonth, context.nationalContext, language)}
        metrics={[
          { label: t("exposedArea", language), value: formatRaiUnit(summary.exposedRai, language) },
          { label: t("highRiskArea", language), value: formatRaiUnit(summary.highRiskRai, language) },
          { label: "จังหวัดรุนแรง", value: String(summary.severityCounts.Severe) },
          { label: "เดือน/โหมด", value: `${formatMonth(state.selectedMonth, language)} · ${labelDataMode(context.mode, language)}` },
        ]}
      />

      <RiskMap onNavigate={onNavigate} />

      <section className="panel-list overview-scroll-panel">
        <PanelHeader icon={<AlertTriangle size={18} />} title={t("topRisks", language)} />
        <div className="panel-scroll-region" tabIndex={0} aria-label="รายการความเสี่ยงเร่งด่วน">
          {topRisks.map((event) => {
            const runtimeEvent = getRuntimeEvent(state, event.id);
            const enrichment = getEventEnrichment(event.id);
            return (
              <button
                type="button"
                key={event.id}
                className="risk-row"
                onClick={() => dispatch({ type: "selectEvent", eventId: event.id, section: "risks" })}
              >
                <span className={`severity-pill ${severityTone[runtimeEvent.severity]}`}>{severityLabel(runtimeEvent.severity, language)}</span>
                <strong>{labelEventTitle(event.id, event.title, language)}</strong>
                <small>{labelHazard(event.hazard, language)} · {labelStatus(runtimeEvent.status, language)}</small>
                <p>{labelEventSummary(event.id, event.summary, language)}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="panel-list action-list overview-scroll-panel">
        <PanelHeader icon={<ClipboardCheck size={18} />} title={t("actionRequired", language)} />
        <div className="panel-scroll-region" tabIndex={0} aria-label="รายการงานที่ต้องทำ">
          {queue.length === 0 ? (
            <p className="empty-note">ไม่มีงานเร่งด่วนในตัวกรองนี้</p>
          ) : (
            queue.map((item) => (
              <button key={item.id + item.label} type="button" className="action-row" onClick={() => dispatch({ type: "setSection", section: item.section })}>
                <strong>{labelQueueItem(item.label, language)}</strong>
                <span>{labelQueueDetail(item.detail, language)}</span>
              </button>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function MapSection({ onNavigate }: { onNavigate: (path: string) => void }) {
  const state = useAppState();
  const language = state.language;
  const record = getProvinceRecord(state.selectedProvinceId, state.selectedMonth);
  const trend = getProvinceTrend(state.selectedProvinceId, 8);
  const layer = getMapLayer(state.mapLayer);
  const layerAvailability = getLayerAvailability(state);
  const layerSources = getLayerSources(layer.id);
  const provinceWorkspacePath = record ? getProvinceWorkspacePath(record.provinceId) : null;

  return (
    <div className="page-grid map-page-grid">
      <RiskMap compact onNavigate={onNavigate} />
      <section className="detail-panel map-detail-panel">
        <PanelHeader icon={<Map size={18} />} title={t("areaProfile", language)} />
        {record && (
          <>
            <div className="profile-head provenance-corner-host">
              <DataProvenanceChip kind={dataProvenanceChipKindFromText(record.provenance)} language={language} />
              <span className={`severity-pill ${severityTone[record.severity]}`}>{severityLabel(record.severity, language)}</span>
              <h2>{record.provinceTh}</h2>
              <p>{labelProvinceProvenance(record.provenance, language)}</p>
            </div>
            {provinceWorkspacePath && (
              <button type="button" className="secondary-button province-workspace-open-button" onClick={() => onNavigate(provinceWorkspacePath)}>
                {record.provinceId === NAKHON_RATCHASIMA_ID ? "เปิดหน้าจังหวัด" : "เปิดโครงหน้าจังหวัด"}
              </button>
            )}
            {record.provinceId === NAKHON_RATCHASIMA_ID && <NakhonRatchasimaWorkspaceSummary compact />}
            <section className="layer-summary provenance-corner-host">
              <DataProvenanceChip kind={layer.dataClass} language={language} />
              <p className="eyebrow">{labelLayerGroup(layer.group, language)}</p>
              <h3>{layer.labelTh}</h3>
              <p>{layerAvailability.title}</p>
              <small>
                {labelLayerAvailability(layerAvailability.status, language)} · แหล่งอ้างอิง {layerSources.map((source) => source.acronym).join(", ")}
              </small>
            </section>
            <dl className="metric-list two-col">
              <div>
                <dt>{t("hazard", language)}</dt>
                <dd>{labelHazard(record.primaryHazard, language)}</dd>
              </div>
              <div>
                <dt>{t("crop", language)}</dt>
                <dd>{labelCrop(record.mainCropExposure, language)}</dd>
              </div>
              <div>
                <dt>{t("exposedArea", language)}</dt>
                <dd>{formatRaiUnit(record.agriculturalAreaExposedRai, language)}</dd>
              </div>
              <div>
                <dt>{t("highRiskArea", language)}</dt>
                <dd>{formatRaiUnit(record.highRiskAreaRai, language)}</dd>
              </div>
            </dl>
            <div className="trend-bars" aria-label="แนวโน้มจังหวัด">
              {trend.map((point) => (
                <div key={point.month} className="trend-point">
                  <span style={{ height: `${20 + point.score * 18}px` }} className={severityTone[point.severity]} />
                  <small>{point.month.slice(5)}</small>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function RisksSection() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const language = state.language;
  const events = getFilteredEvents(state);
  const event = getRuntimeEvent(state);
  const enrichment = getEventEnrichment(event.id);
  const auditTrail = getEventAuditTrail(state, event.id);
  const outcome = getOutcomeForEvent(event.id);
  const [fusion, setFusion] = useState<RiskFusionBreakdown | null>(null);
  const [fusionFailed, setFusionFailed] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    setFusion(null);
    setFusionFailed(false);

    loadRiskFusionBreakdown(event.id)
      .then((result) => {
        if (isCurrent) setFusion(result);
      })
      .catch(() => {
        if (isCurrent) setFusionFailed(true);
      });

    return () => {
      isCurrent = false;
    };
  }, [event.id]);

  return (
    <div className="page-grid risks-grid">
      <section className="panel-list">
        <PanelHeader icon={<AlertTriangle size={18} />} title={t("risks", language)} />
        {events.map((item) => {
          const runtimeEvent = getRuntimeEvent(state, item.id);
          return (
            <button
              type="button"
              key={item.id}
              className={state.selectedEventId === item.id ? "risk-row selected" : "risk-row"}
              onClick={() => dispatch({ type: "selectEvent", eventId: item.id })}
            >
              <span className={`severity-pill ${severityTone[runtimeEvent.severity]}`}>{severityLabel(runtimeEvent.severity, language)}</span>
              <strong>{labelEventTitle(item.id, item.title, language)}</strong>
              <small>{labelRegion(item.region, language)} · {labelStatus(runtimeEvent.status, language)}</small>
            </button>
          );
        })}
        {events.length === 0 && <p className="empty-note">ไม่พบเหตุการณ์ในตัวกรองนี้</p>}
      </section>

      <section className="detail-panel event-detail">
        <div className="event-header">
          <span className={`severity-pill ${severityTone[event.severity]}`}>{severityLabel(event.severity, language)}</span>
          <div>
            <p className="eyebrow">{event.id}</p>
            <h2>{labelEventTitle(event.id, event.title, language)}</h2>
            <p>{labelEventSummary(event.id, event.summary, language)}</p>
          </div>
        </div>
        <dl className="metric-list four-col">
          <div>
            <dt>{t("status", language)}</dt>
            <dd>{labelStatus(event.status, language)}</dd>
          </div>
          <div>
            <dt>{t("confidence", language)}</dt>
            <dd>{labelConfidence(event.confidence, language)}</dd>
          </div>
          <div>
            <dt>ช่วงเวลา</dt>
            <dd>{labelPeriod(enrichment.expectedPeriod, language)}</dd>
          </div>
          <div>
            <dt>เจ้าของงาน</dt>
            <dd>{labelOrganization(enrichment.owner, language)}</dd>
          </div>
        </dl>

        <div className="split-columns">
          <section>
            <PanelHeader icon={<CloudRain size={18} />} title="เหตุผลที่เสี่ยง" />
            {enrichment.drivers.map((driver) => (
              <div key={driver.label} className="driver-row">
                <strong>{labelDriverLabel(driver.label, language)}</strong>
                <span>{labelDriverValue(driver.value, language)}</span>
                <small>{labelProvenance(driver.provenance, language)}</small>
              </div>
            ))}
          </section>
          <section>
            <PanelHeader icon={<Sprout size={18} />} title="ผลกระทบต่อเกษตร" />
            <ul className="clean-list">
              {enrichment.expectedImpacts.map((impact) => (
                <li key={impact}>{labelImpact(impact, language)}</li>
              ))}
            </ul>
          </section>
        </div>

        <details className="evidence-box">
          <summary>{t("evidence", language)} · {labelSourceName(event.sourceContext.official, language)}</summary>
          <dl className="metric-list evidence-list">
            {Object.entries(enrichment.evidence).map(([key, value]) => (
              <div key={key}>
                <dt>{labelEvidenceKey(key, language)}</dt>
                <dd>{labelEvidenceValue(key, value, language)}</dd>
              </div>
            ))}
          </dl>
        </details>

        <section className="fusion-box">
          {fusion ? (
            <>
              <div className="provenance-corner-host">
                <DataProvenanceChip kind="DERIVED" language={language} />
                <p className="eyebrow">{language === "th" ? "ผลคำนวณ" : "Computed"}</p>
                <h3>{fusion.resultLabelTh}</h3>
                <p>{fusion.formulaTh}</p>
              </div>
              <div className="fusion-grid">
                {fusion.components.map((component) => (
                  <article key={component.id} className="fusion-card">
                    <DataProvenanceChip kind={component.dataClass} language={language} />
                    <strong>{component.labelTh}</strong>
                    <p>{labelDriverValue(component.valueTh, language)}</p>
                    <small>{component.interpretationTh}</small>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <div className="provenance-corner-host">
              <DataProvenanceChip kind="PENDING_SOURCE" language={language} />
              <p className="eyebrow">{language === "th" ? "รอยืนยันข้อมูล" : "Pending source"}</p>
              <h3>{fusionFailed ? "ไม่สามารถโหลดคำอธิบายความเสี่ยงได้" : "กำลังโหลดคำอธิบายความเสี่ยง"}</h3>
              <p>{fusionFailed ? "โปรดลองเปิดเหตุการณ์นี้อีกครั้ง" : "กำลังดึงข้อมูลจากส่วนประมวลผล"}</p>
            </div>
          )}
        </section>

        <div className="role-actions">
          {Object.entries(enrichment.recommendedActions).map(([role, actions]) => (
            <section key={role}>
              <h3>{labelActionRole(role, language)}</h3>
              <ul className="clean-list">
                {actions.map((item) => (
                  <li key={item}>{labelRecommendation(item, language)}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="workflow-rail">
          {Object.entries(event.workflow).map(([step, value]) => (
            <span key={step}>
              <CheckCircle2 size={16} />
              <strong>{labelWorkflowStep(step, language)}</strong>
              {labelStatus(value, language)}
            </span>
          ))}
        </div>

        {event.id === MAIN_EVENT_ID && (
          <div className="button-row">
            <button type="button" className="primary-button" onClick={() => dispatch({ type: "selectTask", taskId: MAIN_TASK_ID })}>
              ไปงานภาคสนาม
            </button>
            <button type="button" className="secondary-button" onClick={() => dispatch({ type: "setSection", section: "workflows" })}>
              เปิดคำแนะนำ
            </button>
          </div>
        )}

        <section className="timeline">
          <PanelHeader icon={<ClipboardCheck size={18} />} title="ประวัติสถานะ" />
          {auditTrail.map((entry, index) => (
            <div key={`${entry.at}-${index}`} className="timeline-item">
              <strong>{labelAuditAction(entry.action, language)}</strong>
              <span>{labelOrganization(entry.actor, language)} · {formatAuditTime(entry.at, language)}</span>
            </div>
          ))}
        </section>
        {outcome && (
          <p className="provenance-note">
            {`ตัวชี้วัดผลลัพธ์ต้นแบบ: พื้นที่เสี่ยงที่คาดการณ์ ${formatRai(outcome.predictedHighRiskAreaRai)} ไร่ / พื้นที่กระทบที่ตรวจยืนยัน ${formatRai(outcome.verifiedAffectedAreaRai)} ไร่`}
          </p>
        )}
      </section>
    </div>
  );
}

function ForecastSection() {
  const state = useAppState();
  const language = state.language;
  const month = monthContext(state.selectedMonth);
  const records = getFilteredProvinceRecords(state);
  const summary = summarizeNationalRecords(records);

  return (
    <div className="page-stack">
      <PageSummary
        eyebrow={t("forecast", language)}
        title="แปลสัญญาณอากาศเป็นผลกระทบต่อพืช"
        description={labelMonthNarrative(state.selectedMonth, month.nationalContext, language)}
        metrics={[
          { label: "โหมดข้อมูล", value: labelDataMode(month.mode, language) },
          { label: "แหล่งอ้างอิง", value: labelSource(month.source, language) },
          { label: t("highRiskArea", language), value: formatRaiUnit(summary.highRiskRai, language) },
        ]}
      />
      <div className="horizon-grid">
        {nationalMonthlyBackbone.map((item) => (
          <section key={item.month} className={item.month === state.selectedMonth ? "horizon-card active" : "horizon-card"}>
            <p className="eyebrow">{formatMonth(item.month, language)} · {labelDataMode(item.mode, language)}</p>
            <h3>{labelBackboneLabel(item.label, language)}</h3>
            <p>{labelPrototypeUse(item.prototypeUse, language)}</p>
            <span>{labelSourceType(item.sourceType, language)}</span>
          </section>
        ))}
      </div>
    </div>
  );
}

function CropsSection() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const language = state.language;
  const selectedCrop = state.selectedCrop === "All" ? "Rice" : state.selectedCrop;
  const cropProfile = cropProfiles.find((profile) => profile.crop === selectedCrop) ?? cropProfiles[0];
  const records = getFilteredProvinceRecords({ ...state, selectedCrop: cropProfile.crop });
  const bySeverity = summarizeNationalRecords(records).severityCounts;

  return (
    <div className="page-grid crops-grid">
      <section className="panel-list">
        <PanelHeader icon={<Sprout size={18} />} title={t("crops", language)} />
        {cropProfiles.map((profile) => (
          <button
            key={profile.crop}
            type="button"
            className={profile.crop === cropProfile.crop ? "crop-card active" : "crop-card"}
            onClick={() => dispatch({ type: "setCrop", crop: profile.crop })}
          >
            <strong>{labelCrop(profile.crop, language)}</strong>
            <span>{labelCropCondition(profile.augustCondition, language)}</span>
          </button>
        ))}
      </section>
      <section className="detail-panel crop-detail">
        <PanelHeader icon={<Leaf size={18} />} title={`${labelCrop(cropProfile.crop, language)} · สภาพพืช`} />
        <p>{labelCropStageSummary(cropProfile.stageSummary, language)}</p>
        <p>{labelCropOutlook(cropProfile.seasonalOutlook, language)}</p>
        <div className="summary-strip">
          <MetricCard label="จังหวัดรุนแรง" value={String(bySeverity.Severe)} />
          <MetricCard label="จังหวัดเตือนภัย" value={String(bySeverity.Warning)} />
        </div>
        <p className="provenance-note">
          <strong>เกณฑ์พื้นที่พืช: </strong>
          {labelCropPresenceRule(cropProfile.provincePresenceRule, language)}
        </p>
        <ul className="clean-list">
          {cropProfile.topActions.map((action) => (
            <li key={action}>{labelCropAction(action, language)}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function WorkflowSection() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const language = state.language;
  const task = getTask(state.selectedTaskId);
  const status = getTaskStatus(state, task.id);
  const submitted = state.runtime.taskSubmissions[task.id];
  const initial = submitted ?? {
    ...task.seedObservation,
    photoState: "Mock photo attached",
  };
  const [form, setForm] = useState<VerificationSubmission>(initial);
  const canSubmitReview = status === "Submitted" && ["Draft Ready", "Changes Requested"].includes(state.runtime.advisoryStatus);
  const canApprove = state.runtime.advisoryStatus === "Ready for Review";

  return (
    <div className="page-grid workflow-grid">
      <section className="detail-panel">
        <PanelHeader icon={<ClipboardCheck size={18} />} title="งานตรวจภาคสนาม" />
        <div className="status-row">
          <span className="severity-pill warning">{labelPriority(task.priority, language)}</span>
          <span>{labelStatus(status, language)}</span>
        </div>
        <h2>{labelLocationName(task.farmerGroup, language)}</h2>
        <p>
          {labelCrop(task.crop, language)} · กำหนดส่ง {formatAuditTime(task.dueAt, language)}
        </p>
        <ul className="clean-list">
          {task.checklist.map((item) => (
            <li key={item}>{labelFieldChecklist(item, language)}</li>
          ))}
        </ul>
        <form
          className="verification-form"
          onSubmit={(event) => {
            event.preventDefault();
            dispatch({ type: "submitVerification", submission: form });
          }}
        >
          <label>
            สภาพแปลง
            <input value={labelFieldObservation(form.fieldCondition, language)} onChange={(event) => setForm({ ...form, fieldCondition: event.target.value })} />
          </label>
          <label>
            ระยะพืช
            <input value={labelFieldObservation(form.cropStage, language)} onChange={(event) => setForm({ ...form, cropStage: event.target.value })} />
          </label>
          <label>
            น้ำที่มี
            <input value={labelFieldObservation(form.waterAvailability, language)} onChange={(event) => setForm({ ...form, waterAvailability: event.target.value })} />
          </label>
          <label>
            อาการเครียดที่เห็น
            <input value={labelFieldObservation(form.visibleStress, language)} onChange={(event) => setForm({ ...form, visibleStress: event.target.value })} />
          </label>
          <label className="full">
            ปัญหาที่เกษตรกรรายงาน
            <textarea value={labelFieldObservation(form.farmerReportedIssues, language)} onChange={(event) => setForm({ ...form, farmerReportedIssues: event.target.value })} />
          </label>
          <label className="full">
            บันทึกเพิ่มเติม
            <textarea value={labelFieldObservation(form.note, language)} onChange={(event) => setForm({ ...form, note: event.target.value })} />
          </label>
          <button type="submit" className="primary-button" disabled={status === "Submitted"}>
            <Send size={16} />
            {status === "Submitted" ? "ส่งแล้ว" : t("submitVerification", language)}
          </button>
        </form>
      </section>

      <section className="detail-panel advisory-workspace">
        <PanelHeader icon={<ShieldCheck size={18} />} title="คำแนะนำและอนุมัติ" />
        <div className="status-row">
          <span>{MAIN_ADVISORY_ID}</span>
          <strong>{labelStatus(state.runtime.advisoryStatus, language)}</strong>
        </div>
        <h2>{labelAdvisoryTitle(advisory.title, language)}</h2>
        <p>{labelAdvisorySummary(advisory.riskSummary, language)}</p>
        <div className="advisory-actions">
          {state.runtime.advisoryActions.map((action, index) => (
            <label key={`${action}-${index}`}>
              {`คำแนะนำ ${index + 1}`}
              <textarea
                value={labelAdvisoryAction(action, language)}
                onChange={(event) => dispatch({ type: "updateAdvisoryAction", index, value: event.target.value })}
              />
            </label>
          ))}
        </div>
        <div className="button-row">
          <button type="button" className="primary-button" disabled={!canSubmitReview} onClick={() => dispatch({ type: "submitAdvisoryForReview" })}>
            {t("submitReview", language)}
          </button>
          <button type="button" className="secondary-button" disabled={!canApprove} onClick={() => dispatch({ type: "approveAdvisory" })}>
            {t("approve", language)}
          </button>
          <button type="button" className="secondary-button" disabled={!canApprove} onClick={() => dispatch({ type: "requestChanges" })}>
            {t("requestChanges", language)}
          </button>
        </div>
        {!canSubmitReview && state.runtime.advisoryStatus === "Draft Ready" && (
          <p className="empty-note">ต้องส่งผลตรวจภาคสนามก่อนส่งตรวจอนุมัติ</p>
        )}
      </section>
    </div>
  );
}

function AlertsSection() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const language = state.language;
  const canPublish = state.runtime.advisoryStatus === "Approved";
  const alreadyPublished = state.runtime.advisoryStatus === "Published";

  return (
    <div className="page-grid alerts-grid">
      <section className="detail-panel">
        <PanelHeader icon={<Bell size={18} />} title="เผยแพร่คำเตือนหลายช่องทาง" />
        <div className="channel-grid">
          {publicationChannels.map((channel) => (
            <label key={channel} className="check-row">
              <input
                type="checkbox"
                checked={state.runtime.selectedChannels.includes(channel)}
                onChange={() => dispatch({ type: "toggleChannel", channel })}
                disabled={alreadyPublished}
              />
              <span>{labelChannel(channel, language)}</span>
            </label>
          ))}
        </div>
        <div className="message-preview">
          <p className="eyebrow">ตัวอย่างข้อความ</p>
          <strong>นาข้าวฝนทิ้งช่วงบางพื้นที่: ตรวจระดับน้ำจริงก่อนให้น้ำเพิ่ม</strong>
          <p>{labelAdvisoryAction(state.runtime.advisoryActions[0], language)}</p>
        </div>
        <button type="button" className="primary-button" disabled={!canPublish || alreadyPublished} onClick={() => dispatch({ type: "publishAdvisory" })}>
          {alreadyPublished ? "เผยแพร่แล้ว" : t("publish", language)}
        </button>
        {!canPublish && !alreadyPublished && (
          <p className="empty-note">ต้องอนุมัติคำแนะนำก่อนเผยแพร่</p>
        )}
      </section>
      <section className="panel-list">
        <PanelHeader icon={<BarChart3 size={18} />} title="สถิติหลังเผยแพร่" />
        {state.runtime.deliveryRecords.length === 0 ? (
          <p className="empty-note">ยังไม่มีข้อมูลส่งออก เพราะยังไม่ได้เผยแพร่</p>
        ) : (
          state.runtime.deliveryRecords.map((record) => (
            <div key={record.channel} className="delivery-row">
              <strong>{labelChannel(record.channel, language)}</strong>
              <span>{`ส่งถึง ${formatRai(record.delivered)} ราย · รับทราบ ${formatRai(record.acknowledged)} ราย`}</span>
            </div>
          ))
        )}
      </section>
      <FarmerCard />
    </div>
  );
}

function FarmerExperience() {
  return (
    <div className="farmer-layout">
      <FarmerCard full />
    </div>
  );
}

function FarmerCard({ full = false }: { full?: boolean }) {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const language = state.language;
  const alerts = getFarmerVisibleAlerts(state);
  const event = getRuntimeEvent(state, MAIN_EVENT_ID);

  return (
    <section className={full ? "farmer-card full" : "farmer-card"}>
      <PanelHeader icon={<Leaf size={18} />} title={t("farmerView", language)} />
      <div className="farm-hero">
        <p className="eyebrow">{FARM_ID}</p>
        <h2>{labelFarmName(farmerProfile.farmName, language)}</h2>
        <p>
          {labelCrop(farmerProfile.crop, language)} · {formatRaiUnit(farmerProfile.areaRai, language)} · {labelFarmerCropStage(farmerProfile.cropStage, language)}
        </p>
      </div>
      <div className="farmer-risk">
        <span className={`severity-pill ${severityTone[event.severity]}`}>{severityLabel(event.severity, language)}</span>
        <strong>เสี่ยงเครียดน้ำในนาข้าวช่วงปลาย ส.ค.-ต้น ก.ย.</strong>
        <p>ตรวจระดับน้ำในแปลงจริงก่อนตัดสินใจให้น้ำ และแจ้งเจ้าหน้าที่หากเห็นใบม้วนหรือแปลงแห้งเร็ว</p>
      </div>
      {alerts.length === 0 ? (
        <p className="empty-note">ยังไม่มีคำเตือนใหม่ คำแนะนำจะปรากฏหลังเจ้าหน้าที่เผยแพร่</p>
      ) : (
        alerts.map((alert) => (
          <button key={alert.id} type="button" className="farmer-alert" onClick={() => dispatch({ type: "markAlertRead", alertId: alert.id })}>
            <Bell size={17} />
            <span>
              <strong>{alert.title}</strong>
              <small>{alert.read ? "อ่านแล้ว" : "ใหม่"}</small>
            </span>
          </button>
        ))
      )}
      <ul className="clean-list farmer-actions">
        {state.runtime.advisoryActions.slice(0, 3).map((action) => (
          <li key={action}>{labelAdvisoryAction(action, language)}</li>
        ))}
      </ul>
    </section>
  );
}

function PlanningAnalyticsSection() {
  const state = useAppState();
  const language = state.language;
  const matrixMonths = ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];
  const sampledProvinces = ["TH-P10", "TH-P17", "TH-P46", "TH-P09", "TH-P67"];
  const provinceLabels = sampledProvinces.map((id) => {
    const record = getProvinceRecord(id, state.selectedMonth);
    return { id, label: record?.provinceTh ?? id };
  });

  return (
    <div className="page-stack">
      <section className="detail-panel">
        <PanelHeader icon={<Waves size={18} />} title={t("planning", language)} />
        <div className="risk-matrix" role="table" aria-label="ตารางแนวโน้มรายฤดูกาล">
          <div className="matrix-row head">
            <span>{t("province", language)}</span>
            {matrixMonths.map((month) => (
              <span key={month}>{formatMonth(month, language)}</span>
            ))}
          </div>
          {provinceLabels.map((province) => (
            <div key={province.id} className="matrix-row">
              <strong>{province.label}</strong>
              {matrixMonths.map((month) => {
                const record = getProvinceRecord(province.id, month);
                return (
                  <span key={month} className={`severity-cell ${record ? severityTone[record.severity] : ""}`}>
                    {record ? severityLabel(record.severity, language) : "-"}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </section>
      <section className="panel-list analytics-list">
        <PanelHeader icon={<BarChart3 size={18} />} title="ติดตามผลลัพธ์" />
        {outcomeAnalytics.map((metric) => (
          <div key={metric.riskEventId} className="analytics-row provenance-corner-host">
            <DataProvenanceChip kind={dataProvenanceChipKindFromText(metric.provenance)} language={language} />
            <strong>{metric.riskEventId}</strong>
            <span>{`การเข้าถึงคำแนะนำ ${metric.advisoryReachPct}% · งานตรวจภาคสนามเสร็จ ${metric.fieldVerificationCompletionPct}%`}</span>
            <small>{labelOutcomeProvenance(metric.provenance, language)}</small>
          </div>
        ))}
      </section>
    </div>
  );
}

function DataModelsSection() {
  const language = useAppState().language;
  return (
    <div className="page-stack">
      <section className="detail-panel">
        <PanelHeader icon={<Database size={18} />} title={t("models", language)} />
        <p>ทะเบียนนี้แยกข้อมูลจริง ข้อมูลตัวอย่าง ผลคำนวณ และสถานะจากการใช้งาน เพื่อไม่ให้ผู้ใช้เข้าใจว่าคะแนนรวมเป็นประกาศทางการจากหน่วยงานใดหน่วยงานหนึ่ง</p>
        <DataProvenanceLegend kinds={["REAL", "CANONICAL_SYNTHETIC", "DERIVED", "RUNTIME_STATE", "PENDING_SOURCE"]} language={language} />
      </section>

      <section className="detail-panel">
        <PanelHeader icon={<Database size={18} />} title="ทะเบียนแหล่งข้อมูล" />
        <div className="source-grid">
          {sourceRegistry.map((source) => (
            <article key={source.id} className="source-card provenance-corner-host">
              <DataProvenanceChip kind={source.dataClass} language={language} />
              <p className="eyebrow">{source.acronym}</p>
              <h3>{source.nameTh}</h3>
              <dl className="metric-list">
                <div>
                  <dt>เจ้าของข้อมูล</dt>
                  <dd>{source.ownerTh}</dd>
                </div>
                <div>
                  <dt>ความครอบคลุม</dt>
                  <dd>{source.coverageTh}</dd>
                </div>
                <div>
                  <dt>การเข้าถึง</dt>
                  <dd>{source.accessModeTh}</dd>
                </div>
              </dl>
              <p>{source.prototypeUseTh}</p>
              <p className="provenance-note">{source.limitationTh}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="detail-panel">
        <PanelHeader icon={<Map size={18} />} title="ชั้นข้อมูลแผนที่" />
        <div className="layer-catalog-grid">
          {mapLayerCatalog.map((layer) => (
            <article key={layer.id} className="layer-card provenance-corner-host">
              <DataProvenanceChip kind={layer.dataClass} language={language} />
              <p className="eyebrow">{labelLayerGroup(layer.group, language)}</p>
              <h3>{layer.labelTh}</h3>
              <p>{layer.descriptionTh}</p>
              <dl className="metric-list">
                <div>
                  <dt>พื้นที่</dt>
                  <dd>{layer.geographyGranularityTh}</dd>
                </div>
                <div>
                  <dt>ช่วงเวลา</dt>
                  <dd>{layer.temporalGranularityTh}</dd>
                </div>
                <div>
                  <dt>สถานะเมื่อไม่มีข้อมูล</dt>
                  <dd>{layer.noDataMeaningTh}</dd>
                </div>
              </dl>
              <p className="provenance-note">
                แหล่งอ้างอิง: {getLayerSources(layer.id).map((source) => source.acronym).join(", ")}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="detail-panel">
        <PanelHeader icon={<Database size={18} />} title="แบบจำลองและข้อมูลอ้างอิง" />
        <div className="model-grid">
          {dataModelRegistry.map((record) => (
            <section key={record.id} className="model-card provenance-corner-host">
              <DataProvenanceChip kind={dataProvenanceChipKindFromText(record.provenance)} language={language} />
              <p className="eyebrow">{labelModelFamily(record.family, language)}</p>
              <h3>{labelModelName(record.name, language)}</h3>
              <dl className="metric-list">
                <div>
                  <dt>{t("status", language)}</dt>
                  <dd>{labelStatus(record.status, language)}</dd>
                </div>
                <div>
                  <dt>ครอบคลุม</dt>
                  <dd>{labelModelCoverage(record.coverage, language)}</dd>
                </div>
                <div>
                  <dt>ความสดใหม่</dt>
                  <dd>{labelModelFreshness(record.freshness, language)}</dd>
                </div>
              </dl>
              <p>{labelModelLimitations(record.limitations, language)}</p>
              <p className="provenance-note">
                รุ่นข้อมูล: {labelModelVersion(record.version, language)} · {labelModelProvenance(record.provenance, language)}
              </p>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}

function formatRaiUnit(value: number, _language: "th" | "en") {
  return `${formatRai(value)} ไร่`;
}

function labelQueueItem(label: string, _language: "th" | "en") {
  const labels: Record<string, string> = {
    "Field verification pending": "รอตรวจภาคสนาม",
    "Advisory draft ready": "ร่างคำแนะนำพร้อมส่งตรวจ",
    "Awaiting approval": "รออนุมัติ",
    "Publication pending": "รอเผยแพร่",
  };
  return labels[label] ?? label;
}

function labelQueueDetail(detail: string, _language: "th" | "en") {
  return detail
    .replace("Demo Rice Community", "ชุมชนนาข้าวต้นแบบ")
    .replace("Northern basin demo group", "กลุ่มลุ่มน้ำภาคเหนือ")
    .replace("Rice", "ข้าว")
    .replace("Edit and submit for supervisor review", "แก้ไขแล้วส่งให้ผู้อนุมัติตรวจ")
    .replace("Supervisor review queue", "คิวตรวจของผู้อนุมัติ")
    .replace("Select channels and publish alert", "เลือกช่องทางและเผยแพร่คำเตือน");
}

function PanelHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="panel-header">
      <span>{icon}</span>
      <h2>{title}</h2>
    </div>
  );
}
