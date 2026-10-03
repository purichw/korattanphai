import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AppErrorBoundary } from "../src/components/AppErrorBoundary";
import { AppStateProvider, appReducer, createInitialState, loadInitialState, useAppDispatch, useAppState } from "../src/store";
import { decodePersistedState } from "../src/persistedState";

const values = new Map<string, string>();
const localStorage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { values.set(key, value); },
  removeItem: (key: string) => { values.delete(key); },
};

beforeEach(() => { values.clear(); vi.stubGlobal("localStorage", localStorage); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("persisted state recovery", () => {
  it.each(["{", "null", "[]", "42"])("recovers malformed snapshots: %s", (raw) => {
    expect(decodePersistedState(raw, createInitialState())).toEqual({ state: createInitialState(), invalid: true });
  });

  it("rejects invalid preferences without inventing a forecast month", () => {
    const { state, invalid } = decodePersistedState(JSON.stringify({
      selectedMonth: "2025-99", language: null,
    }), createInitialState());
    expect(invalid).toBe(true);
    expect(state).toEqual({ language: "th", selectedMonth: "" });
  });

  it("migrates only supported preferences from retired workflow snapshots", () => {
    const raw = JSON.stringify({
      selectedMonth: "2025-12", language: "en", section: "alerts", personaId: "u-farmer",
      runtime: { advisoryStatus: "Published", farmerAlerts: [{ title: "Retired alert" }], taskStatus: null },
      toast: "Stale notification",
    });
    localStorage.setItem("korat-tan-phai-demo-state-v1", raw);
    expect(decodePersistedState(raw, createInitialState())).toEqual({
      state: { language: "th", selectedMonth: "2025-12" }, invalid: false,
    });
    expect(loadInitialState()).toEqual({ language: "th", selectedMonth: "2025-12" });
    expect(localStorage.getItem("korat-tan-phai-demo-state-v1")).toBe(raw);
    expect(localStorage.getItem("korat-tan-phai-preferences-v1")).toBeNull();
  });

  it("roundtrips current preferences and accepts an unselected month", () => {
    for (const selectedMonth of ["", "2025-12"]) {
      const state = { language: "th" as const, selectedMonth };
      expect(decodePersistedState(JSON.stringify(state), createInitialState())).toEqual({ state, invalid: false });
    }
    expect(decodePersistedState('{}', createInitialState())).toEqual({ state: createInitialState(), invalid: false });
  });

  it("prefers current settings and never revives older state on malformed current data", () => {
    localStorage.setItem("korat-tan-phai-demo-state-v1", JSON.stringify({ selectedMonth: "2025-12" }));
    localStorage.setItem("korat-tan-phai-preferences-v1", JSON.stringify({ selectedMonth: "2025-11" }));
    expect(loadInitialState().selectedMonth).toBe("2025-11");
    localStorage.setItem("korat-tan-phai-preferences-v1", "{broken");
    expect(loadInitialState()).toEqual(createInitialState());
    expect(localStorage.getItem("korat-tan-phai-preferences-v1")).toBe("{broken");
  });

  it("does not overwrite malformed stored data merely by reading it", () => {
    localStorage.setItem("korat-tan-phai-demo-state-v1", "{broken");
    expect(loadInitialState()).toEqual(createInitialState());
    expect(localStorage.getItem("korat-tan-phai-demo-state-v1")).toBe("{broken");
  });

  it("persists current preferences after an edit, leaving notices transient and old content intact", () => {
    const old = JSON.stringify({ selectedMonth: "2025-12", runtime: { advisoryStatus: "Published" } });
    localStorage.setItem("korat-tan-phai-demo-state-v1", old);
    function Preferences() {
      const state = useAppState();
      const dispatch = useAppDispatch();
      return <>
        <output>{state.selectedMonth}</output>
        <button onClick={() => dispatch({ type: "toast", message: "Temporary notice" })}>Notice</button>
        <button onClick={() => dispatch({ type: "setMonth", month: "2025-11" })}>Change month</button>
      </>;
    }
    const mounted = render(<AppStateProvider><Preferences /></AppStateProvider>);
    expect(screen.getByText("2025-12")).toBeInTheDocument();
    expect(localStorage.getItem("korat-tan-phai-preferences-v1")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Notice" }));
    expect(localStorage.getItem("korat-tan-phai-preferences-v1")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Change month" }));
    expect(screen.getByText("2025-11")).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("korat-tan-phai-preferences-v1")!)).toEqual({ language: "th", selectedMonth: "2025-11" });
    expect(localStorage.getItem("korat-tan-phai-demo-state-v1")).toBe(old);
    mounted.unmount();
  });

  it("keeps notices dismissible without changing the chosen month", () => {
    const selected = appReducer(createInitialState(), { type: "setMonth", month: "2025-12" });
    const notice = appReducer(selected, { type: "toast", message: "Saved" });
    expect(notice.toast).toBe("Saved");
    expect(appReducer(notice, { type: "toast" })).toEqual({ ...selected, toast: undefined });
  });

});

describe("unavailable browser storage", () => {
  it("retains preferences in memory when storage operations throw and clears only legacy login", async () => {
    vi.resetModules();
    const auth = await import("../src/auth");
    const storage = await import("../src/browserStorage");
    vi.spyOn(localStorage, "getItem").mockImplementation(() => { throw new DOMException("denied", "SecurityError"); });
    vi.spyOn(localStorage, "setItem").mockImplementation(() => { throw new DOMException("full", "QuotaExceededError"); });
    vi.spyOn(localStorage, "removeItem").mockImplementation(() => { throw new DOMException("denied", "SecurityError"); });
    expect(storage.readBrowserStorage("preference")).toBeNull();
    expect(storage.writeBrowserStorage("preference", "retained")).toBe(false);
    expect(auth.clearLegacyLogin()).toBe(false);
    expect(storage.readBrowserStorage("preference")).toBe("retained");
  });
});

describe("render error boundary", () => {
  it("recovers on retry without clearing saved state", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    let fail = true;
    function Child() { if (fail) throw new Error("render failed"); return <p>Recovered</p>; }
    localStorage.setItem("existing", "retained");
    render(<AppErrorBoundary onRetry={() => { fail = false; }}><Child /></AppErrorBoundary>);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ลองใหม่" }));
    expect(screen.getByText("Recovered")).toBeInTheDocument();
    expect(localStorage.getItem("existing")).toBe("retained");
  });

  it("allows navigation to recover a failed content region", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    function Failed() { throw new Error("render failed"); }
    const { rerender } = render(<AppErrorBoundary resetKey="one"><Failed /></AppErrorBoundary>);
    rerender(<AppErrorBoundary resetKey="two"><p>Next route</p></AppErrorBoundary>);
    expect(screen.getByText("Next route")).toBeInTheDocument();
  });
});
