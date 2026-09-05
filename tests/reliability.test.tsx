import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AppErrorBoundary } from "../src/components/AppErrorBoundary";
import { createInitialState, loadInitialState } from "../src/store";
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

  it("rejects invalid nested values while retaining valid user edits", () => {
    const { state, invalid } = decodePersistedState(JSON.stringify({
      section: "unknown", selectedMonth: "2025-99", language: "en",
      runtime: { taskStatus: null, advisoryActions: ["คำแนะนำที่แก้ไว้"], farmerAlerts: [{ read: "yes" }],
        eventAuditTrail: { event: [null] }, deliveryRecords: [{ targeted: -1 }], selectedChannels: "SMS" },
    }), createInitialState());
    expect(invalid).toBe(true);
    expect(state.section).toBe("overview");
    expect(state.selectedMonth).toBe("2026-08");
    expect(state.language).toBe("th");
    expect(state.runtime.advisoryActions).toEqual(["คำแนะนำที่แก้ไว้"]);
    expect(state.runtime.taskStatus).toEqual(createInitialState().runtime.taskStatus);
    expect(state.runtime.farmerAlerts).toEqual([]);
    expect(state.runtime.eventAuditTrail).toEqual({});
  });

  it("accepts old partial snapshots and preserves valid runtime records on roundtrip", () => {
    const original = createInitialState();
    original.runtime.eventAuditTrail.event = [{ at: "2026-09-05", action: "Edited", actor: "Pointy" }];
    original.runtime.selectedChannels = ["SMS"];
    expect(decodePersistedState(JSON.stringify(original), createInitialState())).toEqual({ state: original, invalid: false });
    expect(decodePersistedState('{"runtime":{"advisoryStatus":"Approved"}}', createInitialState()).state.runtime.advisoryStatus).toBe("Approved");
  });

  it("does not overwrite malformed stored data merely by reading it", () => {
    localStorage.setItem("korat-tan-phai-demo-state-v1", "{broken");
    expect(loadInitialState()).toEqual(createInitialState());
    expect(localStorage.getItem("korat-tan-phai-demo-state-v1")).toBe("{broken");
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
