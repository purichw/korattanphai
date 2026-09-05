import { expect, test, seedAuthSession } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await seedAuthSession(page);
});

test("home information is passive and disclosures preserve context and the single map", async ({ page }) => {
  await page.goto("/");
  const summary = page.locator(".nr-forecast-overview-summary");
  await expect(summary).toContainText("142/289 ตำบล");
  await expect(summary.locator(".metric-card button, .metric-card a")).toHaveCount(0);
  await expect(page.locator(".nr-home-situation button, .nr-home-situation a")).toHaveCount(0);
  const beforeURL = page.url();
  const attention = page.locator(".nr-forecast-overview-attention");
  await attention.getByRole("button", { name: "ดูทั้งหมด" }).click();
  await expect(attention.locator("li")).toHaveCount(13);
  await attention.locator("li").last().scrollIntoViewIfNeeded();
  expect(await attention.locator("ul").evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(page.url()).toBe(beforeURL);
  await attention.getByRole("button", { name: "ย่อรายการ" }).click();
  await expect(attention.locator("li")).toHaveCount(3);

  const agriculture = page.locator(".nr-home-agriculture");
  await expect(agriculture.locator(".nr-detail-panel-body")).toBeHidden();
  await expect(agriculture.locator(".metric-card-value")).toHaveText(["ข้าว", "67,347 ไร่", "8,081 ไร่", "ปานกลาง"]);
  await agriculture.getByRole("button", { name: "พื้นที่เกษตรที่นำมาประเมิน", exact: true }).click();
  await expect(agriculture.locator(".nr-detail-panel-body")).toContainText("ไม่ใช่ตัวเลขเสียหายทางการ");
  expect(page.url()).toBe(beforeURL);
  await agriculture.getByRole("button", { name: "พื้นที่เกษตรที่นำมาประเมิน", exact: true }).click();
  await expect(agriculture.locator(".nr-detail-panel-body")).toBeHidden();

  const map = page.locator(".nr-map-svg");
  await map.evaluate((element) => element.setAttribute("data-same-map", "home"));
  const readiness = page.locator(".nr-home-readiness");
  await readiness.getByRole("button", { name: "ความพร้อมข้อมูล", exact: true }).click();
  await expect(readiness.locator(".nr-readiness-breakdown-list dd")).toHaveText(["6 ตำบล", "24 ตำบล", "4 ตำบล", "255 ตำบล"]);
  await readiness.getByRole("button", { name: "ดูความพร้อมบนแผนที่" }).click();
  await expect(page.getByRole("heading", { name: "แผนที่ความพร้อมข้อมูลพื้นที่", exact: true })).toBeVisible();
  await expect(map).toHaveCount(1);
  await expect(map).toHaveAttribute("data-same-map", "home");
  await expect(page.locator(".nr-map-panel")).not.toHaveClass(/has-forecast-archive-map/);
  await page.getByRole("button", { name: "กลับแผนที่พยากรณ์" }).click();
  await expect(page.locator(".nr-map-panel")).toHaveClass(/has-forecast-archive-map/);
  await expect(map).toHaveAttribute("data-same-map", "home");
  await expect(summary.locator(".metric-card-value")).toHaveText(["13 ตำบล", "129 ตำบล", "0 ตำบล", "147 ตำบล"]);
  await page.locator(".nr-forecast-overview-source summary").click();
  await expect(page.locator(".nr-forecast-overview-source")).toContainText("ไม่ใช่รายงานสถานการณ์จริง");
  expect(page.url()).toBe(beforeURL);
});

test("home layout retains centered stats and usable map geometry at every breakpoint", async ({ page }, testInfo) => {
  const viewports = testInfo.project.name === "desktop"
    ? [{ width: 1586, height: 992 }, { width: 1448, height: 1086 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }]
    : [{ width: 390, height: 844 }];
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.locator(".nr-map-shape")).toHaveCount(289);
    await expect(page.locator(".nr-dashboard-map-header h2")).toBeVisible();
    const map = await page.locator(".nr-dashboard-map-card").boundingBox();
    const svg = await page.locator(".nr-map-svg").boundingBox();
    const header = await page.locator(".nr-dashboard-map-header").boundingBox();
    expect(svg!.height).toBeGreaterThan(220);
    expect(svg!.y).toBeGreaterThanOrEqual(header!.y + header!.height - 1);
    expect(svg!.y + svg!.height).toBeLessThanOrEqual(map!.y + map!.height + 1);
    if (viewport.width > 720) {
      const panel = await page.locator(".nr-forecast-overview-attention").boundingBox();
      expect(Math.abs(panel!.y + panel!.height - map!.y - map!.height)).toBeLessThanOrEqual(2);
    }
    const styles = await page.locator(".nr-forecast-overview-summary .metric-card-value").evaluateAll((elements) => elements.map((element) => getComputedStyle(element).textAlign));
    expect(styles.every((style) => style === "center")).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator(".nr-map-distance-scale")).toBeVisible();
  }
});

test("home mobile filter sheet restores focus and keeps fixed context passive", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile filter-sheet contract");
  await page.goto("/");
  const edit = page.getByRole("button", { name: "แก้ไขตัวกรองข้อมูล", exact: true });
  await edit.click();
  const sheet = page.getByRole("dialog", { name: "ตัวกรองข้อมูล", exact: true });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("combobox")).toHaveCount(2);
  await expect(sheet).toContainText("ภัยแล้ง");
  await expect(sheet).toContainText("T+1");
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(edit).toBeFocused();
  await expect(page.locator(".operational-filter-chip.is-fixed button")).toHaveCount(0);
});

test("home map failure retains summary and offers reload without losing the target", async ({ page }) => {
  let attempts = 0;
  await page.route("**/geodata/nakhon-ratchasima-subdistricts.geojson", async (route) => {
    if (++attempts === 1) await route.fulfill({ status: 503, body: "Unavailable" });
    else await route.continue();
  });
  await page.goto("/?target=2025-11&district=3008");
  await expect(page.locator(".nr-map-loading[role=alert]")).toContainText("ไม่สามารถโหลดขอบเขตตำบล");
  await expect(page.locator(".nr-forecast-overview-summary")).toContainText("อ.ด่านขุนทด");
  await page.getByRole("button", { name: "ลองโหลดแผนที่ใหม่" }).click();
  await expect(page.locator(".nr-map-shape")).toHaveCount(289);
  await expect(page).toHaveURL(/target=2025-11/);
  await expect(page).toHaveURL(/district=3008/);
  await expect(page.locator(".nr-forecast-overview-summary")).toContainText("อ.ด่านขุนทด");
});
