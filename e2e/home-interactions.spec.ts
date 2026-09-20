import { expect, test, seedAuthSession } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await seedAuthSession(page);
});

test("home information stays passive without readiness panels or map actions", async ({ page }, testInfo) => {
  await page.goto("/?mapLayer=forecast-archive&target=2015-06&horizon=1");
  const summary = page.locator(".nr-forecast-overview-summary");
  await expect(summary).toContainText("117/289 ตำบล");
  await expect(summary.locator(".metric-card button, .metric-card a")).toHaveCount(0);
  await expect(page.locator(".nr-home-situation button, .nr-home-situation a")).toHaveCount(0);
  const beforeURL = page.url();
  const attention = page.locator(".nr-forecast-overview-attention");
  await attention.getByRole("button", { name: "ดูทั้งหมด" }).click();
  await expect(attention.locator("li")).toHaveCount(60);
  await attention.locator("li").last().scrollIntoViewIfNeeded();
  expect(await attention.locator("ul").evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(page.url()).toBe(beforeURL);
  await attention.getByRole("button", { name: "ย่อรายการ" }).click();
  await expect(attention.locator("li")).toHaveCount(3);

  await expect(page.locator(".nr-home-agriculture")).toHaveCount(0);
  await expect(page.locator(".nr-home-situation .metric-card-label")).toHaveText(["ผลพยากรณ์ภัยแล้ง", "พืชที่ประเมิน"]);
  await expect(page.getByText(/67,347|8,081|พื้นที่ประเมินทั้งจังหวัด|ความเชื่อมั่นข้อมูลเกษตร/)).toHaveCount(0);

  const map = page.locator(".nr-map-svg");
  await expect(map).toHaveCount(1);
  await expect(page.locator(".nr-map-panel")).toHaveClass(/has-forecast-archive-map/);
  await expect(page.locator(".nr-home-readiness, .nr-prediction-readiness, .nr-readiness-map-action, .nr-return-forecast")).toHaveCount(0);
  await expect(page.getByText(/ความพร้อมข้อมูล|ดูความพร้อมบนแผนที่/)).toHaveCount(0);
  await expect(page.locator(".nr-home-support, .nr-home-archive")).toHaveCount(0);
  await expect(summary.getByRole("link", { name: "ดูพยากรณ์ล่วงหน้า 6 เดือน", exact: true })).toHaveAttribute("href", /\/drought\?.*target=2015-06/);
  await expect(summary.locator(".metric-card-value")).toHaveText(["60 ตำบล", "32 ตำบล", "25 ตำบล", "172 ตำบล"]);
  await expect(page.locator(".nr-data-transparency, .nr-forecast-overview-source")).toHaveCount(0);
  await expect(page.getByText(/^(แหล่งข้อมูลและความสด|ข้อจำกัดสำคัญ|แหล่งข้อมูลและข้อจำกัด)$/)).toHaveCount(0);
  expect(page.url()).toBe(beforeURL);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.screenshot({ path: testInfo.outputPath("home-without-readiness.png"), fullPage: true, scale: "css" });
  await page.goto("/?mapLayer=forecast-archive&target=2025-12&horizon=1&district=3008&irrigation=rainfed");
  await expect(summary).toContainText("อ.ด่านขุนทด");
  await expect(page.getByText(/ความพร้อมข้อมูล|ดูความพร้อมบนแผนที่/)).toHaveCount(0);
  await expect(page.locator(".nr-home-readiness, .nr-prediction-readiness")).toHaveCount(0);
});

test("home layout retains centered stats and usable map geometry at every breakpoint", async ({ page }, testInfo) => {
  const viewports = testInfo.project.name === "desktop"
    ? [{ width: 1586, height: 992 }, { width: 1448, height: 1086 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }]
    : [{ width: 390, height: 844 }];
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/?mapLayer=forecast-archive");
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
  await page.goto("/?mapLayer=forecast-archive");
  const edit = page.getByRole("button", { name: "แก้ไขตัวกรองข้อมูล", exact: true });
  await edit.click();
  const sheet = page.getByRole("dialog", { name: "ตัวกรองข้อมูล", exact: true });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("combobox")).toHaveCount(2);
  await expect(sheet).toContainText("ภัยแล้ง");
  await expect(sheet).toContainText("1 เดือน");
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
  await page.goto("/?mapLayer=forecast-archive&target=2025-11&district=3008");
  await expect(page.locator(".nr-map-loading[role=alert]")).toContainText("ไม่สามารถโหลดขอบเขตตำบล");
  await expect(page.locator(".nr-forecast-overview-summary")).toContainText("อ.ด่านขุนทด");
  await page.getByRole("button", { name: "ลองโหลดแผนที่ใหม่" }).click();
  await expect(page.locator(".nr-map-shape")).toHaveCount(289);
  await expect(page).toHaveURL(/target=2025-11/);
  await expect(page).toHaveURL(/district=3008/);
  await expect(page.locator(".nr-forecast-overview-summary")).toContainText("อ.ด่านขุนทด");
});
