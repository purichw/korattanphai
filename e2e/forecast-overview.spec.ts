import { expect, test, type Page, seedAuthSession } from "./fixtures";

async function selectArea(page: Page, name: string) {
  const edit = page.getByRole("button", { name: "แก้ไขตัวกรองข้อมูล" });
  if (await edit.isVisible()) await edit.click();
  await page.getByRole("combobox", { name: /^(เลือก)?อำเภอ/ }).click();
  await page.getByRole("option", { name, exact: true }).click();
  const apply = page.getByRole("button", { name: "แสดงผล", exact: true });
  if (await apply.isVisible()) await apply.click();
}

test.beforeEach(async ({ page }) => {
  await seedAuthSession(page);
});

test("overview paints the T+1 archive, scopes districts, and preserves forecast drilldown", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  let fullArchiveRequests = 0;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => { if (/drought_forecast_archive_rev03.*\.json$/.test(request.url())) fullArchiveRequests += 1; });
  await page.goto("/");
  const overview = page.locator(".nr-forecast-overview");
  const summary = overview.locator(".nr-forecast-overview-summary");
  await expect(summary).toContainText("117/289 ตำบล");
  await expect(overview.locator(".nr-forecast-overview-context")).toContainText("พยากรณ์ ม.ค. 2569");
  await expect(overview.locator(".nr-forecast-overview-context")).toContainText("เดือนตั้งต้น (T) ธ.ค. 2568");
  await expect(overview).not.toContainText("รอชุดข้อมูลใหม่");
  await expect(summary.locator(".metric-card-value")).toHaveText(["0 ตำบล", "117 ตำบล", "0 ตำบล", "172 ตำบล"]);
  await expect(page.locator(".nr-map-shape")).toHaveCount(289);
  await expect(overview.locator(".nr-forecast-overview-attention li")).toHaveCount(0);
  expect(fullArchiveRequests).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("overview-full.png"), fullPage: true });
  await page.screenshot({ path: testInfo.outputPath("overview-viewport.png") });

  await selectArea(page, "ด่านขุนทด");
  await expect(summary).toContainText("อ.ด่านขุนทด");
  await expect(summary).toContainText("6/16 ตำบล");
  await expect(summary.locator(".metric-card-value")).toHaveText(["0 ตำบล", "6 ตำบล", "0 ตำบล", "10 ตำบล"]);
  await expect(overview.locator(".nr-forecast-overview-details")).toHaveAttribute("href", /dan-khun-thot\?mapLayer=forecast-archive&target=2025-12&horizon=1/);
  await page.reload();
  await expect(summary).toContainText("อ.ด่านขุนทด");
  await overview.locator(".nr-forecast-overview-details").click();
  await expect(page.locator(".nr-drought-compact-workspace")).toBeVisible();
  await expect(page.locator(".nr-drought-workspace-horizon [aria-selected=true]")).toContainText("T+1");
  expect(fullArchiveRequests).toBe(1);
  await page.goBack();
  await selectArea(page, "ทุกอำเภอ");
  await page.goto('/?target=2015-06&horizon=1');
  const firstArea = overview.locator(".nr-forecast-overview-attention li a").first();
  const href = await firstArea.getAttribute("href");
  await firstArea.click();
  await expect(page).toHaveURL(new RegExp(href!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$"));
  await expect(page.locator(".nr-drought-compact-workspace")).toBeVisible();
  await expect(page.locator(".nr-drought-workspace-kpis")).toContainText("เสี่ยงสูง");
  expect(errors).toEqual([]);
});

test("overview failures remain empty and retry preserves the requested target", async ({ page }) => {
  let attempts = 0;
  await page.route(/forecast-overview-t1.*\.json$/, async (route) => {
    if (++attempts === 1) await route.fulfill({ status: 503, body: "Unavailable" });
    else await route.continue();
  });
  await page.goto("/?target=2025-11&horizon=5");
  await expect(page.getByRole("alert")).toHaveText("โหลดข้อมูลพยากรณ์ไม่สำเร็จ กรุณาลองใหม่");
  await expect(page.locator(".nr-forecast-overview-summary")).toHaveCount(0);
  await page.getByRole("button", { name: "ลองใหม่", exact: true }).click();
  await expect(page.locator(".nr-forecast-overview-context")).toContainText("พยากรณ์ ธ.ค. 2568");
  await expect(page.locator(".nr-forecast-overview-context")).toContainText("เดือนตั้งต้น (T) พ.ย. 2568");
  await expect(page.locator(".nr-forecast-overview-context")).toContainText("(T+1)");
  await expect(page.locator(".nr-forecast-overview-details")).toHaveAttribute("href", /target=2025-11&horizon=1/);
});

test("changing month updates map counts and risk filtering uses the same forecast", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".nr-forecast-overview-summary")).toContainText("117/289 ตำบล");
  const edit = page.getByRole("button", { name: "แก้ไขตัวกรองข้อมูล" });
  if (await edit.isVisible()) await edit.click();
  await page.getByRole("combobox", { name: /^เดือนตั้งต้น |^เลือกเดือนตั้งต้น$/ }).click();
  await page.getByRole("option", { name: "พ.ย. 2568", exact: true }).click();
  const apply = page.getByRole("button", { name: "แสดงผล", exact: true });
  if (await apply.isVisible()) await apply.click();
  await expect(page.locator(".nr-forecast-overview-summary .metric-card-value"))
    .toHaveText(["0 ตำบล", "48 ตำบล", "69 ตำบล", "172 ตำบล"]);
  await expect(page.locator(".nr-map-shape.is-forecast-no-risk")).toHaveCount(69);
  await expect(page.locator(".nr-map-shape.is-forecast-out-of-scope")).toHaveCount(172);
  await expect(page.locator(".nr-forecast-overview-context")).toContainText("พยากรณ์ ธ.ค. 2568");
  await expect(page.locator(".nr-forecast-overview-context")).toContainText("เดือนตั้งต้น (T) พ.ย. 2568");
  await expect(page).toHaveURL(/target=2025-11&horizon=1/);
  await page.getByRole("combobox", { name: "สถานะพยากรณ์ภัยแล้ง", exact: true }).click();
  await page.getByRole("option", { name: "เสี่ยงสูง", exact: true }).click();
  await expect(page.locator(".nr-map-shape:not(.is-criteria-filtered)")).toHaveCount(0);
  await page.locator(".nr-local-map-reset").click();
  await expect(page.locator(".nr-map-shape:not(.is-criteria-filtered)")).toHaveCount(289);
});
