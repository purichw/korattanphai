import { expect, test } from "@playwright/test";

test("login restores a deep link including month, horizon and hash", async ({ page }) => {
  await page.goto("/dan-khun-thot/t-300806?mapLayer=forecast-archive&target=2025-12&horizon=4#forecast");
  await page.getByLabel("ชื่อผู้ใช้").fill("pointy");
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page.getByRole("heading", { name: "บ้านเก่า", exact: true })).toBeVisible();
  await expect(page.locator(".nr-drought-workspace-horizon").getByRole("tab", { selected: true })).toContainText("T+4");
  await expect(page).toHaveURL(/target=2025-12&horizon=4#forecast/);
});

test("malformed persisted runtime shows a notice and a usable map", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("korat-tan-phai-login-user", "pointy");
    localStorage.setItem("korat-tan-phai-demo-state-v1", JSON.stringify({ runtime: { taskStatus: null, farmerAlerts: "invalid" } }));
  });
  await page.goto("/");
  await expect(page.locator(".storage-notice")).toBeVisible();
  await expect(page.locator(".nr-map-shape")).toHaveCount(289);
  expect(errors).toEqual([]);
});

test("blocked storage does not prevent login or forecast navigation", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    for (const method of ["getItem", "setItem", "removeItem"]) Object.defineProperty(Storage.prototype, method, {
      value: () => { throw new DOMException("Blocked", "SecurityError"); },
    });
  });
  await page.goto("/login");
  await page.getByLabel("ชื่อผู้ใช้").fill("pointy");
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page.locator(".nr-forecast-overview-summary")).toContainText("142/289");
  await expect(page.locator(".storage-notice")).toBeVisible();
  await page.locator(".nr-forecast-overview-details").click();
  await expect(page.locator(".nr-map-shape")).toHaveCount(289);
  expect(errors).toEqual([]);
});

test("a failed dashboard chunk leaves login light and offers recovery", async ({ page }) => {
  let requests = 0;
  await page.route(/\/(?:src\/AuthenticatedApp\.tsx|assets\/AuthenticatedApp-[\w-]+\.js)(?:\?.*)?$/, async (route) => {
    requests += 1;
    if (requests === 1) await route.abort();
    else await route.continue();
  });
  await page.goto("/login");
  await page.getByLabel("ชื่อผู้ใช้").fill("pointy");
  expect(requests).toBe(0);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page.getByRole("heading", { name: "ไม่สามารถแสดงหน้านี้ได้" })).toBeVisible();
  await page.getByRole("button", { name: "ลองใหม่", exact: true }).click();
  await expect(page.locator(".nr-forecast-overview-summary")).toContainText("142/289");
  expect(requests).toBe(2);
});
