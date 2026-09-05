import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthChangeEvent, Session, SupabaseClient } from "@supabase/supabase-js";
import { authErrorMessage, clearLegacyLogin, getAccountDisplayName, safeInternalRedirect } from "../src/auth";
import { readAuthConfiguration } from "../src/authConfig";
import { useAuth } from "../src/useAuth";
import { authTestSession, authTestUrl, authTestKey, authTestUser } from "./fixtures/supabase.mjs";

const session = authTestSession() as Session;
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};
function clientFixture() {
  let notify: (event: AuthChangeEvent, value: Session | null) => void = () => {};
  const unsubscribe = vi.fn();
  const auth = {
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    onAuthStateChange: vi.fn((callback) => { notify = callback; return { data: { subscription: { unsubscribe } } }; }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: { session }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
  };
  const load = vi.fn().mockResolvedValue({ auth } as unknown as SupabaseClient);
  return { auth, load, unsubscribe, emit: (event: AuthChangeEvent, value: Session | null) => notify(event, value) };
}
beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Supabase session lifecycle", () => {
  it("stays checking until initial restoration resolves, ignoring INITIAL_SESSION snapshots", async () => {
    const client = clientFixture();
    const pending = deferred<unknown>();
    client.auth.getSession.mockReturnValue(pending.promise);
    const { result, unmount } = renderHook(() => useAuth(client.load));
    await waitFor(() => expect(client.auth.getSession).toHaveBeenCalledOnce());
    act(() => client.emit("INITIAL_SESSION", null));
    expect(result.current.status).toBe("checking");
    await act(async () => pending.resolve({ data: { session }, error: null }));
    expect(result.current.status).toBe("signedIn");
    expect(result.current.user?.email).toBe(authTestUser.email);
    unmount();
    expect(client.unsubscribe).toHaveBeenCalledOnce();
  });

  it("never restores an old getSession result after logout or late token refresh", async () => {
    const client = clientFixture();
    const pending = deferred<unknown>();
    client.auth.getSession.mockReturnValue(pending.promise);
    const { result } = renderHook(() => useAuth(client.load));
    await waitFor(() => expect(client.auth.getSession).toHaveBeenCalledOnce());
    await act(async () => { await result.current.signOut(); });
    await act(async () => pending.resolve({ data: { session }, error: null }));
    act(() => client.emit("TOKEN_REFRESHED", session));
    expect(result.current.status).toBe("signedOut");
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("newer signed-out events invalidate pending restoration", async () => {
    const client = clientFixture();
    const pending = deferred<unknown>();
    client.auth.getSession.mockReturnValue(pending.promise);
    const { result } = renderHook(() => useAuth(client.load));
    await waitFor(() => expect(client.auth.getSession).toHaveBeenCalledOnce());
    act(() => client.emit("SIGNED_OUT", null));
    await act(async () => pending.resolve({ data: { session }, error: null }));
    expect(result.current.user).toBeNull();
  });

  it("trims email, preserves password verbatim and prevents duplicate submissions", async () => {
    const client = clientFixture();
    const pending = deferred<unknown>();
    client.auth.signInWithPassword.mockReturnValue(pending.promise);
    const { result } = renderHook(() => useAuth(client.load));
    await waitFor(() => expect(result.current.status).toBe("signedOut"));
    let first!: Promise<void>;
    act(() => {
      first = result.current.signIn("  operator@example.test  ", "  unchanged  ");
      void result.current.signIn("operator@example.test", "another");
    });
    expect(result.current.signingIn).toBe(true);
    expect(client.auth.signInWithPassword).toHaveBeenCalledExactlyOnceWith({ email: "operator@example.test", password: "  unchanged  " });
    await act(async () => { pending.resolve({ data: { session }, error: null }); await first; });
    expect(result.current.status).toBe("signedIn");
    expect(result.current.signingIn).toBe(false);
  });

  it("ignores a late sign-in response/event after logout, but allows a new deliberate login", async () => {
    const client = clientFixture();
    const pending = deferred<unknown>();
    client.auth.signInWithPassword.mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => useAuth(client.load));
    await waitFor(() => expect(result.current.status).toBe("signedOut"));
    let login!: Promise<void>;
    act(() => { login = result.current.signIn("a@b.test", "first"); });
    await act(async () => { await result.current.signOut(); });
    await act(async () => { client.emit("SIGNED_IN", session); pending.resolve({ data: { session }, error: null }); await login; });
    expect(result.current.status).toBe("signedOut");
    await act(async () => { await result.current.signIn("a@b.test", "next"); });
    expect(result.current.status).toBe("signedIn");
  });

  it.each([
    [{ status: 400, code: "invalid_credentials", message: "internal detail" }, "อีเมลหรือรหัสผ่านไม่ถูกต้อง"],
    [{ name: "AuthRetryableFetchError", status: 0 }, "ติดต่อระบบเข้าสู่ระบบไม่ได้"],
  ])("reports safe sign-in errors without authenticating", async (error, message) => {
    const client = clientFixture();
    client.auth.signInWithPassword.mockResolvedValue({ data: { session: null }, error });
    const { result } = renderHook(() => useAuth(client.load));
    await waitFor(() => expect(result.current.status).toBe("signedOut"));
    await act(async () => { await result.current.signIn("a@b.test", "wrong"); });
    expect(result.current.status).toBe("signedOut");
    expect(result.current.signInError).toContain(message);
    expect(result.current.signInError).not.toContain("internal detail");
  });

  it.each([false, true])("handles logout errors according to whether SDK cleared the session (%s)", async (locallyCleared) => {
    const client = clientFixture();
    client.auth.getSession.mockResolvedValue({ data: { session }, error: null });
    client.auth.signOut.mockImplementation(async () => {
      if (locallyCleared) client.emit("SIGNED_OUT", null);
      return { error: { status: 503 } };
    });
    const { result } = renderHook(() => useAuth(client.load));
    await waitFor(() => expect(result.current.status).toBe("signedIn"));
    let outcome: boolean | undefined;
    await act(async () => { outcome = await result.current.signOut(); });
    expect(outcome).toBe(locallyCleared);
    expect(result.current.status).toBe(locallyCleared ? "signedOut" : "signedIn");
    expect(result.current.signOutError).toContain(locallyCleared ? "ออกจากระบบบนเครื่องนี้แล้ว" : "ออกจากระบบไม่สำเร็จ");
    expect(result.current.signingOut).toBe(false);
  });

  it("fails closed without configuration and can retry session initialization errors", async () => {
    const load = vi.fn().mockResolvedValue(null);
    const { result } = renderHook(() => useAuth(load));
    await waitFor(() => expect(result.current.status).toBe("unconfigured"));
    await act(async () => { await result.current.signIn("pointy", ""); });
    expect(result.current.user).toBeNull();
    load.mockRejectedValueOnce(new Error("private detail"));
    act(() => result.current.retrySession());
    await waitFor(() => expect(result.current.status).toBe("error"));
    const client = clientFixture();
    load.mockResolvedValue(await client.load());
    act(() => result.current.retrySession());
    await waitFor(() => expect(result.current.status).toBe("signedOut"));
  });
});

describe("auth boundaries", () => {
  it("removes only legacy login, without treating it as a session", () => {
    window.localStorage.setItem("korat-tan-phai-login-user", "pointy");
    window.localStorage.setItem("retained-preference", "yes");
    clearLegacyLogin();
    expect(window.localStorage.getItem("korat-tan-phai-login-user")).toBeNull();
    expect(window.localStorage.getItem("retained-preference")).toBe("yes");
  });

  it("uses metadata only as a display name, with an email fallback", () => {
    expect(getAccountDisplayName(authTestUser)).toBe("ผู้ทดสอบระบบ");
    expect(getAccountDisplayName({ ...authTestUser, user_metadata: { full_name: {}, role: "admin" } })).toBe(authTestUser.email);
  });

  it.each([null, "https://evil.test/", "//evil.test/", "/\\evil.test/", "/login", "/login/?next=//evil.test", "/\n/evil.test"])("rejects unsafe redirects: %s", (value) => {
    expect(safeInternalRedirect(value, "https://example.test")).toBe("/");
  });
  it("preserves internal path, query and fragment", () => {
    const path = "/dan-khun-thot/t-300806?target=2025-12&horizon=4#forecast";
    expect(safeInternalRedirect(path, "https://example.test")).toBe(path);
  });
  it("requires browser-safe configuration, not secret keys or privileged JWTs", () => {
    expect(readAuthConfiguration(authTestUrl, authTestKey)).toEqual({ url: authTestUrl, publishableKey: authTestKey });
    for (const key of [undefined, "", "sb_secret_never_publish", "eyJhbGciOiJIUzI1NiJ9.privileged.jwt", "sb_publishable_REPLACE_ME"]) {
      expect(readAuthConfiguration(authTestUrl, key)).toBeNull();
    }
    for (const url of [undefined, "http://example.test", "https://u:p@project.supabase.co", "https://project.supabase.co/path", "https://evil.test"]) {
      expect(readAuthConfiguration(url, authTestKey)).toBeNull();
    }
  });
  it("does not construct a client when environment is missing", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
    const { getSupabaseClient } = await import("../src/supabase");
    expect(await getSupabaseClient()).toBeNull();
  });
  it("does not expose unknown error contents", () => {
    expect(authErrorMessage(new Error("private server details"))).not.toContain("private");
  });
});
