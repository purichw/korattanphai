import { type ReactNode, lazy, Suspense, useEffect, useRef, useState } from "react";
import { safeInternalRedirect } from "./auth";
import { authHome, authLoginPath, authScopeForPath, safeAuthRedirect } from './authScope';
import { LoginFrame, LoginPage } from './components/LoginScreen';
import { useAuth } from "./useAuth";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { StorageNotice } from "./components/StorageNotice";
import { AppStartup } from "./components/AppStartup";

const AuthenticatedApp = lazy(async () => {
  const { bootstrapCmsReferences } = await import('./data/cmsReferences');
  await bootstrapCmsReferences();
  return import('./AuthenticatedApp');
});

const currentLocation = () => window.location.pathname + window.location.search + window.location.hash;

export function App() {
  const [scope] = useState(() => authScopeForPath(window.location.pathname));
  const auth = useAuth();
  const [location, setLocation] = useState(currentLocation);
  const lastLocation = useRef(location);
  lastLocation.current = location;
  const explicitLogout = useRef(false);
  const path = new URL(location, window.location.origin).pathname;
  const loginPath = authLoginPath(scope);
  const isLoginPath = path === loginPath || path === `${loginPath}/`;

  const navigate = (nextPath: string) => {
    if (!window.dispatchEvent(new Event('ktp:before-navigation', { cancelable: true }))) return;
    const next = safeInternalRedirect(nextPath, window.location.origin);
    // Crossing the auth boundary starts a fresh document and scoped SDK client.
    if (authScopeForPath(new URL(next, window.location.origin).pathname) !== scope) {
      window.location.assign(next); return;
    }
    window.history.pushState(null, "", next);
    setLocation(currentLocation());
  };

  useEffect(() => {
    const handlePopState = () => {
      if (!window.dispatchEvent(new Event('ktp:before-navigation', { cancelable: true }))) {
        window.history.pushState(null, '', lastLocation.current);
        return;
      }
      if (authScopeForPath(window.location.pathname) !== scope) { window.location.reload(); return; }
      setLocation(currentLocation());
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [scope]);

  useEffect(() => {
    if (auth.status === "signedOut" && !isLoginPath) {
      const next = safeAuthRedirect(currentLocation(), window.location.origin, scope);
      const destination = explicitLogout.current || next === authHome(scope) ? loginPath : `${loginPath}?next=${encodeURIComponent(next)}`;
      window.history.replaceState(null, "", destination);
      setLocation(currentLocation());
    } else if (auth.status === "signedIn" && isLoginPath) {
      const requested = new URL(currentLocation(), window.location.origin).searchParams.get("next");
      window.history.replaceState(null, "", safeAuthRedirect(requested, window.location.origin, scope));
      setLocation(currentLocation());
    }
  }, [auth.status, isLoginPath, location, loginPath, scope]);

  const handleLogout = async () => {
    if (!window.dispatchEvent(new Event('ktp:before-navigation', { cancelable: true }))) return;
    explicitLogout.current = true;
    const signedOut = await auth.signOut();
    if (!signedOut) explicitLogout.current = false;
  };

  let content: ReactNode;
  if (auth.status === "unconfigured") {
    content = <LoginFrame scope={scope}><p role="alert">ระบบเข้าสู่ระบบยังไม่พร้อม กรุณาติดต่อผู้ดูแลระบบ</p></LoginFrame>;
  } else if (auth.status === "error") {
    content = <LoginFrame scope={scope}><p role="alert">ตรวจสอบการเข้าสู่ระบบไม่ได้ กรุณาตรวจการเชื่อมต่อแล้วลองใหม่</p>
      <button type="button" className="primary-button" onClick={auth.retrySession}>ลองใหม่</button></LoginFrame>;
  } else if (auth.status === "checking" || (auth.status === "signedIn" && isLoginPath)) {
    content = isLoginPath
      ? <LoginFrame scope={scope}><p role="status">กำลังตรวจสอบการเข้าสู่ระบบ...</p></LoginFrame>
      : <AppStartup path={path} message="กำลังตรวจสอบการเข้าสู่ระบบ..." />;
  } else if (auth.status === "signedOut") {
    content = <LoginPage scope={scope} pending={auth.signingIn || auth.signingOut} error={auth.signInError || auth.signOutError}
      onLogin={(email, password) => { explicitLogout.current = false; return auth.signIn(email, password); }} />;
  } else if (auth.status === "signedIn") {
    content = <>
      {auth.signOutError && <div className="auth-session-error" role="alert">{auth.signOutError}</div>}
      <Suspense fallback={<AppStartup path={path} message="กำลังเปิดโคราชทันภัย..." />}>
        <AuthenticatedApp key={auth.user.id} loginUser={auth.user} onLogout={() => { void handleLogout(); }}
          signingOut={auth.signingOut} path={path} onNavigate={navigate} />
      </Suspense>
    </>;
  } else content = <LoginFrame scope={scope}><p role="status">กำลังตรวจสอบการเข้าสู่ระบบ...</p></LoginFrame>;

  return <AppErrorBoundary onRetry={() => window.location.reload()}><StorageNotice />{content}</AppErrorBoundary>;
}
