import { type FormEvent, type ReactNode, lazy, Suspense, useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { safeInternalRedirect } from "./auth";
import { useAuth } from "./useAuth";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { StorageNotice } from "./components/StorageNotice";
import { AppStartup } from "./components/AppStartup";

const AuthenticatedApp = lazy(() => import("./AuthenticatedApp"));

function LoginFrame({ children }: { children: ReactNode }) {
  return (
    <main className="login-page" lang="th">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-brand">
          <img src="/brand/korat-tan-phai-emblem.webp" width="768" height="768" alt="" aria-hidden="true" decoding="async" />
          <div><p className="eyebrow">Korat Tan Phai</p><h1 id="login-title">เข้าสู่ระบบ</h1></div>
        </div>
        {children}
      </section>
    </main>
  );
}

function LoginPage({ onLogin, pending, error }: {
  onLogin: (email: string, password: string) => Promise<void>;
  pending: boolean;
  error: string | null;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const submitLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!pending) void onLogin(email, password);
  };

  return (
    <LoginFrame>
      <p>โคราชทันภัย</p>
      <form className="login-form" onSubmit={submitLogin} aria-busy={pending}>
        <label htmlFor="login-email">อีเมล</label>
        <input id="login-email" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false}
          required autoFocus value={email} disabled={pending} onChange={(event) => setEmail(event.target.value)} />
        <label htmlFor="login-password">รหัสผ่าน</label>
        <div className="login-password-field">
          <input id="login-password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password"
            required value={password} disabled={pending} onChange={(event) => setPassword(event.target.value)} />
          <button type="button" className="login-password-toggle" aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
            title={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"} aria-controls="login-password" aria-pressed={showPassword}
            disabled={pending} onClick={() => setShowPassword((value) => !value)}>
            {showPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
          </button>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="primary-button" disabled={pending}>{pending ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}</button>
      </form>
    </LoginFrame>
  );
}

const currentLocation = () => window.location.pathname + window.location.search + window.location.hash;

export function App() {
  const auth = useAuth();
  const [location, setLocation] = useState(currentLocation);
  const explicitLogout = useRef(false);
  const path = new URL(location, window.location.origin).pathname;
  const isLoginPath = path === "/login" || path === "/login/";

  const navigate = (nextPath: string) => {
    window.history.pushState(null, "", safeInternalRedirect(nextPath, window.location.origin));
    setLocation(currentLocation());
  };

  useEffect(() => {
    const handlePopState = () => setLocation(currentLocation());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (auth.status === "signedOut" && !isLoginPath) {
      const next = safeInternalRedirect(currentLocation(), window.location.origin);
      const loginPath = explicitLogout.current || next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`;
      window.history.replaceState(null, "", loginPath);
      setLocation(currentLocation());
    } else if (auth.status === "signedIn" && isLoginPath) {
      const requested = new URL(currentLocation(), window.location.origin).searchParams.get("next");
      window.history.replaceState(null, "", safeInternalRedirect(requested, window.location.origin));
      setLocation(currentLocation());
    }
  }, [auth.status, isLoginPath, location]);

  const handleLogout = async () => {
    explicitLogout.current = true;
    const signedOut = await auth.signOut();
    if (!signedOut) explicitLogout.current = false;
  };

  let content: ReactNode;
  if (auth.status === "unconfigured") {
    content = <LoginFrame><p role="alert">ระบบเข้าสู่ระบบยังไม่พร้อม กรุณาติดต่อผู้ดูแลระบบ</p></LoginFrame>;
  } else if (auth.status === "error") {
    content = <LoginFrame><p role="alert">ตรวจสอบการเข้าสู่ระบบไม่ได้ กรุณาตรวจการเชื่อมต่อแล้วลองใหม่</p>
      <button type="button" className="primary-button" onClick={auth.retrySession}>ลองใหม่</button></LoginFrame>;
  } else if (auth.status === "checking" || (auth.status === "signedIn" && isLoginPath)) {
    content = isLoginPath
      ? <LoginFrame><p role="status">กำลังตรวจสอบการเข้าสู่ระบบ...</p></LoginFrame>
      : <AppStartup path={path} message="กำลังตรวจสอบการเข้าสู่ระบบ..." />;
  } else if (auth.status === "signedOut") {
    content = <LoginPage pending={auth.signingIn || auth.signingOut} error={auth.signInError || auth.signOutError}
      onLogin={(email, password) => { explicitLogout.current = false; return auth.signIn(email, password); }} />;
  } else if (auth.status === "signedIn") {
    content = <>
      {auth.signOutError && <div className="auth-session-error" role="alert">{auth.signOutError}</div>}
      <Suspense fallback={<AppStartup path={path} message="กำลังเปิดโคราชทันภัย..." />}>
        <AuthenticatedApp key={auth.user.id} loginUser={auth.user} onLogout={() => { void handleLogout(); }}
          signingOut={auth.signingOut} path={path} onNavigate={navigate} />
      </Suspense>
    </>;
  } else content = <LoginFrame><p role="status">กำลังตรวจสอบการเข้าสู่ระบบ...</p></LoginFrame>;

  return <AppErrorBoundary onRetry={() => window.location.reload()}><StorageNotice />{content}</AppErrorBoundary>;
}
