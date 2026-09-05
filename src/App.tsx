import { type FormEvent, lazy, Suspense, useEffect, useState } from "react";
import { authenticateUsername, clearStoredLogin, readStoredLogin, writeStoredLogin, type LoginUser } from "./auth";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { StorageNotice } from "./components/StorageNotice";

const AuthenticatedApp = lazy(() => import("./AuthenticatedApp"));


function LoginPage({ onLogin }: { onLogin: (user: LoginUser) => void }) {
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");

  const submitLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const user = authenticateUsername(username);
    if (!user) {
      setError("ไม่พบชื่อผู้ใช้นี้");
      return;
    }
    setError("");
    onLogin(user);
  };

  return (
    <main className="login-page" lang="th">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-brand">
          <img
            src="/brand/korat-tan-phai-emblem.webp"
            width="768"
            height="768"
            alt=""
            aria-hidden="true"
            decoding="async"
          />
          <div>
            <p className="eyebrow">Korat Tan Phai</p>
            <h1 id="login-title">เข้าสู่ระบบ</h1>
          </div>
        </div>
        <p>ใส่ชื่อผู้ใช้เพื่อเข้าหน้าโคราชทันภัย</p>
        <form className="login-form" onSubmit={submitLogin}>
          <label>
            ชื่อผู้ใช้
            <input
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="กรอกชื่อผู้ใช้"
            />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button type="submit" className="primary-button">เข้าสู่ระบบ</button>
        </form>
      </section>
    </main>
  );
}

export function App() {
  const [loginUser, setLoginUser] = useState<LoginUser | null>(() => readStoredLogin());
  const [path, setPath] = useState(() => window.location.pathname);
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  const navigate = (nextPath: string) => {
    window.history.pushState(null, "", nextPath);
    setPath(window.location.pathname);
  };

  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!loginUser && path !== "/login") {
      setPendingPath(window.location.pathname + window.location.search + window.location.hash);
      window.history.replaceState(null, "", "/login");
      setPath("/login");
    }
    if (loginUser && path === "/login") {
      window.history.replaceState(null, "", "/");
      setPath("/");
    }
  }, [loginUser, path]);

  const handleLogin = (user: LoginUser) => {
    writeStoredLogin(user);
    setLoginUser(user);
    const nextPath = pendingPath && pendingPath !== "/login" ? pendingPath : "/";
    setPendingPath(null);
    window.history.replaceState(null, "", nextPath);
    setPath(window.location.pathname);
  };

  const handleLogout = () => {
    clearStoredLogin();
    setLoginUser(null);
    window.history.pushState(null, "", "/login");
    setPath("/login");
  };

  if (!loginUser || path === "/login") {
    return <><StorageNotice /><LoginPage onLogin={handleLogin} /></>;
  }

  return (
    <AppErrorBoundary onRetry={() => window.location.reload()}>
      <StorageNotice />
      <Suspense fallback={<main className="app-recovery" lang="th" role="status">กำลังเปิดโคราชทันภัย...</main>}>
        <AuthenticatedApp loginUser={loginUser} onLogout={handleLogout} path={path} onNavigate={navigate} />
      </Suspense>
    </AppErrorBoundary>
  );
}
