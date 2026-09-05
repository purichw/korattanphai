import { test, expect, authTestEmail, authTestUser, authStorageKey, seedAuthSession, fillAuthForm } from "./fixtures";

test("legacy demo login cannot bypass auth; password visibility, keyboard submit and refresh work", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    localStorage.setItem("korat-tan-phai-login-user", "pointy");
    localStorage.setItem("auth-test-preference", "retained");
  });
  const requested = "/dan-khun-thot/t-300806?mapLayer=forecast-archive&target=2025-12&horizon=4#forecast";
  await page.goto(requested);
  await expect(page.getByLabel("อีเมล", { exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.get("next")).toBe(requested);
  expect(await page.evaluate(() => localStorage.getItem("korat-tan-phai-login-user"))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("auth-test-preference"))).toBe("retained");
  await page.reload();
  await expect(page.getByLabel("อีเมล", { exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: testInfo.outputPath("supabase-login.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await fillAuthForm(page);
  const password = page.getByLabel("รหัสผ่าน", { exact: true });
  await expect(password).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "แสดงรหัสผ่าน", exact: true }).click();
  await expect(password).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "ซ่อนรหัสผ่าน", exact: true }).click();
  await password.press("Enter");
  await expect(page.getByRole("heading", { name: /ภัยแล้ง.*บ้านเก่า/, level: 1 })).toBeVisible();
  await expect(page).toHaveURL(new URL(requested, page.url()).href);
  await page.reload();
  await expect(page.getByRole("heading", { name: /ภัยแล้ง.*บ้านเก่า/, level: 1 })).toBeVisible();
  await expect(page).toHaveURL(new URL(requested, page.url()).href);
  await page.getByRole("button", { name: /บัญชีผู้ใช้/ }).click();
  const menu = page.getByRole("menu", { name: "บัญชีผู้ใช้" });
  await expect(menu).toContainText(authTestEmail);
  await expect(menu).toContainText(authTestUser.user_metadata.full_name);
  await expect(menu.getByRole("group", { name: "มุมมองการแสดงผล" })).toHaveCount(0);
  await expect(menu.getByRole("menuitem", { name: "คืนค่าข้อมูลเริ่มต้น" })).toHaveCount(0);
  await page.getByRole("menuitem", { name: "ออกจากระบบ", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator(".app-shell")).toHaveCount(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), authStorageKey)).toBeNull();
  await page.reload();
  await expect(page.getByLabel("อีเมล", { exact: true })).toHaveValue("");
  await expect(page.locator(".app-shell")).toHaveCount(0);
});

test("pending login blocks duplicates and reports a separate safe network error", async ({ page, authMock }) => {
  authMock.passwordDelayMs = 500;
  authMock.passwordNetworkError = true;
  const logs: string[] = [];
  page.on("console", (message) => logs.push(message.text()));
  await page.goto("/login");
  await fillAuthForm(page);
  await page.getByLabel("รหัสผ่าน", { exact: true }).press("Enter");
  await expect(page.getByRole("button", { name: "กำลังเข้าสู่ระบบ..." })).toBeDisabled();
  await expect(page.getByLabel("อีเมล", { exact: true })).toBeDisabled();
  await expect(page.getByRole("alert")).toContainText("ติดต่อระบบเข้าสู่ระบบไม่ได้");
  expect(authMock.requests.filter((request) => request.grant === "password")).toHaveLength(1);
  expect(logs.join(" ")).not.toMatch(/Test password|test-only-refresh-token|test-signature/);
});

test("a refreshed SDK session stays on the requested route", async ({ page, authMock }) => {
  await seedAuthSession(page, Math.floor(Date.now() / 1000) - 5);
  await page.goto("/dan-khun-thot?target=2025-12&horizon=4");
  await expect(page.locator(".nr-drought-compact-workspace")).toBeVisible();
  await expect(page).toHaveURL(/dan-khun-thot\?target=2025-12&horizon=4/);
  expect(authMock.requests.some((request) => request.grant === "refresh_token")).toBe(true);
});

test("logout server failure reflects the SDK local signout and never leaves account content visible", async ({ page, authMock }) => {
  await seedAuthSession(page);
  authMock.logoutError = true;
  await page.goto("/");
  await page.getByRole("button", { name: /บัญชีผู้ใช้/ }).click();
  await page.getByRole("menuitem", { name: "ออกจากระบบ", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("alert")).toContainText("ออกจากระบบบนเครื่องนี้แล้ว");
  await expect(page.locator(".app-shell")).toHaveCount(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), authStorageKey)).toBeNull();
});

test("external login return URL is rejected", async ({ page }) => {
  await page.goto("/login?next=https%3A%2F%2Fevil.test%2F");
  await fillAuthForm(page);
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page.locator(".nr-forecast-overview")).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/");
  expect(new URL(page.url()).hostname).toBe("127.0.0.1");
});
