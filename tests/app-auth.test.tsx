import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { App } from "../src/App";
import { getSupabaseClient } from "../src/supabase";
import { authTestSession } from "./fixtures/supabase.mjs";

vi.mock("../src/supabase", () => ({ getSupabaseClient: vi.fn() }));
vi.mock("../src/AuthenticatedApp", () => ({ default: ({ path, onLogout }) => <main>Protected: {path}<button onClick={onLogout}>Logout</button></main> }));
beforeEach(() => {
  window.history.replaceState(null, "", "/");
  vi.stubGlobal("localStorage", { getItem: () => null, removeItem: () => {}, setItem: () => {} });
});
afterEach(() => { vi.resetAllMocks(); vi.unstubAllGlobals(); });

it("denies entry with missing environment and never displays an enabled login form", async () => {
  vi.mocked(getSupabaseClient).mockResolvedValue(null);
  render(<App />);
  expect(screen.getByText("กำลังตรวจสอบการเข้าสู่ระบบ...")).toBeInTheDocument();
  expect(await screen.findByRole("alert")).toHaveTextContent("ระบบเข้าสู่ระบบยังไม่พร้อม");
  expect(screen.queryByLabelText("อีเมล")).toBeNull();
  expect(screen.queryByText(/Protected:/)).toBeNull();
});

it("restores a session without flashing the login form and unmounts account content on signout", async () => {
  let resolve!: (value: unknown) => void;
  let notify: (event: string, session: unknown) => void = () => {};
  const unsubscribe = vi.fn();
  const session = authTestSession();
  const auth = {
    getSession: vi.fn(() => new Promise((done) => { resolve = done; })),
    onAuthStateChange: vi.fn((callback) => { notify = callback; return { data: { subscription: { unsubscribe } } }; }),
    signOut: vi.fn(async () => { notify("SIGNED_OUT", null); return { error: null }; }),
  };
  vi.mocked(getSupabaseClient).mockResolvedValue({ auth } as never);
  window.history.replaceState(null, "", "/dan-khun-thot/t-300806?target=2025-12&horizon=4#forecast");
  const { unmount } = render(<App />);
  await waitFor(() => expect(auth.getSession).toHaveBeenCalledOnce());
  expect(screen.queryByLabelText("อีเมล")).toBeNull();
  expect(screen.queryByText(/Protected:/)).toBeNull();
  await act(async () => resolve({ data: { session }, error: null }));
  await screen.findByText(/Protected: \/dan-khun-thot\/t-300806/);
  expect(window.location.search).toBe("?target=2025-12&horizon=4");
  const blockDirtyDeparture = (event: Event) => event.preventDefault();
  window.addEventListener('ktp:before-navigation', blockDirtyDeparture);
  try {
    fireEvent.click(screen.getByRole("button", { name: "Logout" }));
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(screen.getByText(/Protected:/)).toBeInTheDocument();
  } finally { window.removeEventListener('ktp:before-navigation', blockDirtyDeparture); }
  fireEvent.click(screen.getByRole("button", { name: "Logout" }));
  await screen.findByLabelText("อีเมล");
  expect(window.location.pathname).toBe("/login");
  expect(window.location.search).toBe("");
  expect(screen.queryByText(/Protected:/)).toBeNull();
  unmount();
  expect(unsubscribe).toHaveBeenCalledOnce();
});

it("returns to the latest filter URL after session expiry, including direct history updates", async () => {
  let notify: (event: string, session: unknown) => void = () => {};
  const auth = {
    getSession: vi.fn().mockResolvedValue({ data: { session: authTestSession() }, error: null }),
    onAuthStateChange: vi.fn((callback) => { notify = callback; return { data: { subscription: { unsubscribe: vi.fn() } } }; }),
  };
  vi.mocked(getSupabaseClient).mockResolvedValue({ auth } as never);
  window.history.replaceState(null, "", "/drought?target=2025-12&horizon=1");
  render(<App />);
  await screen.findByText(/Protected: \/drought/);
  const updated = "/drought?target=2025-11&horizon=4#forecast";
  window.history.replaceState(null, "", updated);
  act(() => notify("SIGNED_OUT", null));
  await screen.findByLabelText("อีเมล");
  expect(new URLSearchParams(window.location.search).get("next")).toBe(updated);
});

it("keeps CSP restricted to self plus the exact HTTPS Supabase origin", () => {
  const config = JSON.parse(readFileSync("vercel.json", "utf8"));
  const csp = config.headers[0].headers.find((header) => header.key === "Content-Security-Policy").value as string;
  expect(csp.split(";").map((value) => value.trim()).find((value) => value.startsWith("connect-src")))
    .toBe("connect-src 'self' https://dihchjflzhcekywarhxd.supabase.co");
  expect(csp).toContain("script-src 'self'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(config.buildCommand).toBe("npm run build:protected");
});

it('keeps direct admin entry on its own login and retains the draft return URL', async () => {
  const auth = {
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  };
  vi.mocked(getSupabaseClient).mockResolvedValue({ auth } as never);
  window.history.replaceState(null, '', '/admin?draft=123');
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'เข้าสู่ระบบผู้ดูแล' })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/admin/login');
  expect(new URLSearchParams(window.location.search).get('next')).toBe('/admin?draft=123');
  expect(screen.queryByText(/Protected:/)).toBeNull();
});
