import { lazy, Suspense, useEffect, useId, useRef, useState } from "react";
import { BarChart3, ChevronUp, LogOut, Menu, UserRound, X } from "lucide-react";
import { PageLoadBoundary, PageLoadPending } from './components/PageLoadBoundary';
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { SidebarBrand } from "./components/SidebarBrand";
import { DatabaseWorkspaceProvider, useDatabaseWorkspace } from "./DatabaseWorkspaceProvider";
import { WorkspaceAccessProvider } from './access/WorkspaceAccessProvider';
import { WorkspaceBookmarks } from "./components/WorkspaceBookmarks";
import { ForecastExcelExport } from "./components/ForecastExcelExport";
import { WorkspaceSearch, WorkspaceSearchTrigger } from "./components/WorkspaceSearch";
import { WorkspaceEmptyState } from "./components/WorkspaceEmptyState";
import { getAccountDisplayName, type LoginUser } from "./auth";
import { authScopeForPath } from './authScope';
import { AdminNavigation, adminViewFromSearch } from './admin/AdminNavigation';
import { NakhonRatchasimaWorkspace } from "./components/NakhonRatchasimaWorkspace";
import { getNakhonRatchasimaProvinceTabPath, isWorkspaceAppRoute, resolveAppRoute } from "./domain";
import { t } from "./i18n";
import { AppStateProvider, useAppDispatch, useAppState } from "./store";

const AdminWorkspace = lazy(() => import('./admin/AdminWorkspace'));

function AccountControl({
  loginUser,
  onLogout,
  signingOut,
}: {
  loginUser: LoginUser;
  onLogout: () => void;
  signingOut: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId().replaceAll(":", "");
  const accountDisplayName = getAccountDisplayName(loginUser);
  const accountLabel = `บัญชีผู้ใช้ ${accountDisplayName}`;

  useEffect(() => {
    if (!isOpen) return;

    const frame = window.requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLButtonElement>('[role^="menuitem"]:not(:disabled)')?.focus({ preventScroll: true });
    });
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      window.requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const closeMenu = () => {
    setIsOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
  };

  return (
    <div ref={rootRef} className="account-menu" onBlur={(event) => {
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setIsOpen(false);
    }}>
      <button
        ref={triggerRef}
        type="button"
        className="account-trigger"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        aria-label={accountLabel}
        title={accountDisplayName}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setIsOpen(true);
          }
        }}
      >
        <span className="account-trigger-avatar"><UserRound size={18} aria-hidden="true" /></span>
        <span className="account-trigger-copy">
          <strong>บัญชีผู้ใช้</strong>
          <small>{accountDisplayName}</small>
        </span>
        <ChevronUp className="account-trigger-chevron" size={16} aria-hidden="true" />
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
          <div ref={menuRef} id={menuId} className="account-menu-popover" role="menu" aria-label="บัญชีผู้ใช้"
            onKeyDown={(event) => {
              if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
              const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]:not(:disabled)'));
              if (!items.length) return;
              event.preventDefault();
              const current = items.indexOf(document.activeElement as HTMLButtonElement);
              const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
                : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
              items[next]?.focus({ preventScroll: true });
            }}>
            <div className="account-menu-heading" role="presentation">
              <span>บัญชีผู้ใช้</span>
            </div>
            <div className="account-menu-profile" role="presentation">
              <UserRound size={18} aria-hidden="true" />
              <span>
                <strong>{accountDisplayName}</strong>
                {loginUser.email !== accountDisplayName && <small>{loginUser.email}</small>}
              </span>
            </div>
            <div className="account-menu-divider" role="presentation" />
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
  const app = <PageLoadBoundary path={props.path}><AppStateProvider><AppShell {...props} /></AppStateProvider></PageLoadBoundary>;
  // CMS has its own client and navigation; visitor forecast/saved services do
  // not belong to an Admin session even though the visual shell is shared.
  if (authScopeForPath(props.path) === 'admin') return app;
  const workspace = import.meta.env.VITE_DATA_BACKEND === "supabase"
    ? <DatabaseWorkspaceProvider key={props.loginUser.id} userId={props.loginUser.id}>{app}</DatabaseWorkspaceProvider>
    : app;
  // Officer eligibility is a separate domain from Admin sessions/CMS membership.
  // Do not enable configured roles until data-side enforcement is deployed.
  return <WorkspaceAccessProvider userId={props.loginUser.id} state={{ status: 'compatibility' }}>{workspace}</WorkspaceAccessProvider>;
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [savedSelectionVersion, setSavedSelectionVersion] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [exportRequest, setExportRequest] = useState(0);
  const databaseWorkspace = useDatabaseWorkspace();
  const openSearch = () => setSearchOpen(true);
  const restoreSavedWorkspace = (destination: string) => {
    setSavedSelectionVersion((version) => version + 1);
    onNavigate(destination);
  };
  const appRoute = resolveAppRoute(path);
  const isAdmin = authScopeForPath(path) === 'admin';
  const adminView = adminViewFromSearch(window.location.search);
  const nakhonRoute = appRoute.kind === "nakhon-ratchasima" ? appRoute.target : null;
  const isDroughtSubNavActive = Boolean(
    nakhonRoute?.valid && (nakhonRoute.level !== "province" || nakhonRoute.tab === "drought"),
  );
  const isHomeOverview = Boolean(nakhonRoute?.valid && nakhonRoute.level === "province" && nakhonRoute.tab === "overview");


  return (
    <div className={`app-shell${isDroughtSubNavActive ? " is-operational-drought" : ""}${isHomeOverview ? " is-home-overview" : ""}${isAdmin ? " is-admin-workspace" : ""}`} lang={language}>
      <a className="skip-link" href="#workspace-content" onClick={(event) => {
        event.preventDefault();
        document.getElementById('workspace-content')?.focus();
      }}>ข้ามไปเนื้อหาหลัก</a>
      <aside className={isMobileMenuOpen ? "sidebar mobile-menu-open" : "sidebar"} aria-label="เมนูหลัก">
        <SidebarBrand compactMobileLogo={isDroughtSubNavActive || isHomeOverview || isAdmin} mobileWordmark={isAdmin} label={t("brand", language)} />
        <button
          type="button"
          className="mobile-menu-toggle"
          aria-expanded={isMobileMenuOpen}
          aria-controls="sidebar-navigation"
          aria-label={isMobileMenuOpen ? "ปิดเมนูหลัก" : "เปิดเมนูหลัก"}
          onClick={() => setIsMobileMenuOpen((isOpen) => !isOpen)}
        >
          {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        {!isAdmin && <div className="mobile-account-slot">
          <WorkspaceBookmarks onNavigate={restoreSavedWorkspace} />
          <WorkspaceSearchTrigger compact onOpen={openSearch} />
        </div>}
        <div id="sidebar-navigation" className="sidebar-navigation">
          {isAdmin ? <AdminNavigation view={adminView} onNavigate={destination => {
            onNavigate(destination);
            setIsMobileMenuOpen(false);
          }} /> : <nav id="primary-navigation" className="primary-nav">
            <div className="nav-group">
              <button
                type="button"
                className={isDroughtSubNavActive ? "nav-item" : "nav-item active"}
                aria-current={isDroughtSubNavActive ? undefined : 'page'}
                onClick={() => { onNavigate("/"); setIsMobileMenuOpen(false); }}
              >
                <BarChart3 size={17} />
                <span>{t("overview", language)}</span>
              </button>
              <div className="nav-subnav" aria-label="เมนูย่อยภาพรวม">
                <button
                  type="button"
                  className={isDroughtSubNavActive ? "nav-subitem active" : "nav-subitem"}
                  aria-current={isDroughtSubNavActive ? 'page' : undefined}
                  onClick={() => {
                    onNavigate(getNakhonRatchasimaProvinceTabPath("drought"));
                    setIsMobileMenuOpen(false);
                  }}
                >
                  <span>ภัยแล้ง</span>
                </button>
              </div>
            </div>
            <ForecastExcelExport openRequest={exportRequest} onOpen={() => setIsMobileMenuOpen(false)} />
          </nav>}
          <div className="sidebar-account">
            <AccountControl
              loginUser={loginUser}
              onLogout={onLogout}
              signingOut={signingOut}
            />
          </div>
        </div>
      </aside>

      <main className="main-panel">
        {!isAdmin && <header className="topbar">
          <div className="topbar-brand">
            <h1 className="sr-only">{t("brand", language)}</h1>
          </div>
          <div className="topbar-actions">
            <WorkspaceBookmarks onNavigate={restoreSavedWorkspace} />
            <WorkspaceSearchTrigger onOpen={openSearch} />
          </div>
        </header>}

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
          <AppErrorBoundary resetKey={path}>
          {isAdmin ? <Suspense fallback={<PageLoadPending />}>
            <AdminWorkspace userId={loginUser.id} draftId={new URLSearchParams(window.location.search).get('draft')} view={adminView} onNavigate={onNavigate} />
          </Suspense> : nakhonRoute ? (
            <NakhonRatchasimaWorkspace key={savedSelectionVersion} route={nakhonRoute} onNavigate={onNavigate} />
          ) : (
            <WorkspaceEmptyState heading="h2" title="ไม่พบพื้นที่" description="ที่อยู่เว็บนี้ไม่ตรงกับพื้นที่ในจังหวัดนครราชสีมา"
              action={<button type="button" className="primary-button" onClick={() => onNavigate("/")}>กลับภาพรวม</button>} />
          )}
          </AppErrorBoundary>
        </div>
      </main>
      {!isAdmin && searchOpen && <WorkspaceSearch userId={loginUser.id} includeExport={Boolean(databaseWorkspace)}
        onNavigate={destination => { setIsMobileMenuOpen(false); restoreSavedWorkspace(destination); }}
        onExport={() => setExportRequest(value => value + 1)} onClose={() => setSearchOpen(false)} />}
    </div>
  );
}
