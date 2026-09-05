import { expect, test, fillAuthForm } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await fillAuthForm(page);
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page.getByRole("button", { name: /บัญชีผู้ใช้/ })).toBeVisible();
});

for (const [scope, path] of [["province", "/drought"], ["district", "/dan-khun-thot"], ["subdistrict", "/dan-khun-thot/t-300806"]]) {
  test(`compact ${scope} shares filters, all stats, and a single map through readiness mode`, async ({ page }, testInfo) => {
    await page.goto(`${path}?mapLayer=forecast-archive&target=2025-12&horizon=1`);
    const workspace = page.locator(`.nr-drought-compact-workspace.is-${scope}`);
    const filters = page.locator(".nr-operational-filters");
    await expect(workspace).toBeVisible();
    await expect(page.locator(".nr-data-transparency, .nr-forecast-overview-source")).toHaveCount(0);
    await expect(page.getByText(/^(แหล่งข้อมูลและความสด|ข้อจำกัดสำคัญ)$/)).toHaveCount(0);
    await expect(filters.getByRole("combobox")).toHaveCount(3);
    await expect(filters.locator(".nr-fixed-filter")).toHaveText(["ภัยภัยแล้ง", "พืชข้าว"]);
    await expect(workspace.locator(".nr-drought-workspace-context .is-crop")).toContainText("ข้าว");
    await expect(workspace.locator(".nr-drought-workspace-kpis .is-coverage")).toContainText("100%");
    await expect(workspace.locator(".nr-drought-workspace-kpis .is-out-of-scope")).toBeVisible();
    await expect(page.locator(".nr-operational-forecast-summary")).toHaveClass(/has-risk/);
    const chart = workspace.locator(".nr-drought-workspace-chart-card");
    await expect(chart).toHaveCount(scope === "subdistrict" ? 0 : 1);
    const map = workspace.locator(".nr-map-svg");
    await expect(map.locator(".nr-map-shape")).toHaveCount(289);
    if (scope === "subdistrict") {
      await expect.poll(async () => {
        const shape = await map.locator('[data-nr-subdistrict-code="300806"]').boundingBox();
        const frame = await map.boundingBox();
        return Boolean(shape && frame && shape.width > 35 && shape.height > 15 && shape.x >= frame.x
          && shape.y >= frame.y && shape.x + shape.width <= frame.x + frame.width
          && shape.y + shape.height <= frame.y + frame.height);
      }).toBe(true);
    }
    const geometry = await page.evaluate(() => {
      const box = (selector: string) => document.querySelector(selector)!.getBoundingClientRect().toJSON();
      const kpis = document.querySelector(".nr-drought-workspace-kpis")!;
      return { filter: box(".nr-operational-filters"), horizon: box(".nr-drought-workspace-horizon"),
        chart: document.querySelector(".nr-drought-workspace-chart-card")?.getBoundingClientRect().toJSON(),
        body: box(".nr-drought-workspace-body"), map: box(".nr-drought-workspace-map-card"), kpis: box(".nr-drought-workspace-kpis"),
        gridAreas: getComputedStyle(document.querySelector(".nr-drought-workspace-body")!).gridTemplateAreas,
        statsOverflow: kpis.scrollWidth > kpis.clientWidth + 1,
        pageOverflow: document.documentElement.scrollWidth > innerWidth,
        alignment: getComputedStyle(kpis.querySelector("strong")!).textAlign,
        itemAlignment: getComputedStyle(kpis.querySelector(".metric-card")!).justifyItems,
      };
    });
    expect(geometry.filter.bottom).toBeLessThanOrEqual(geometry.horizon.top);
    expect(geometry.statsOverflow).toBe(false);
    expect(geometry.pageOverflow).toBe(false);
    expect(geometry.alignment).toBe("center");
    expect(geometry.itemAlignment).toBe("center");
    if (scope === "subdistrict") {
      expect(geometry.gridAreas).not.toContain("chart");
      expect(geometry.map.width).toBeCloseTo(geometry.body.width, 0);
      if (page.viewportSize()!.width > 900) {
        expect(geometry.kpis.top).toBeGreaterThan(geometry.map.bottom);
      } else {
        expect(geometry.kpis.bottom).toBeLessThan(geometry.map.top);
      }
    } else if (page.viewportSize()!.width > 1180) {
      expect(geometry.chart.top).toBe(geometry.map.top);
      expect(geometry.chart.height).toBe(geometry.map.height);
      expect(geometry.kpis.top).toBeGreaterThan(geometry.map.bottom);
    } else {
      expect(geometry.kpis.bottom).toBeLessThan(geometry.chart.top);
      expect(geometry.chart.bottom).toBeLessThan(geometry.map.top);
    }
    await filters.getByRole("combobox", { name: /^ระยะพยากรณ์/ }).click();
    await page.getByRole("option", { name: "T+4", exact: true }).click();
    await expect(page).toHaveURL(/horizon=4/);
    await expect(workspace.getByRole("tab", { name: /T\+4/ })).toHaveAttribute("aria-selected", "true");
    await expect(workspace.locator(".nr-drought-workspace-context .is-issue")).toContainText("ส.ค. 2568");
    if (scope !== "subdistrict") {
      await expect(workspace.locator(".nr-forecast-point-group.is-active")).toContainText("T+4");
    }

    const details = workspace.locator(".nr-drought-workspace-details");
    await details.locator("summary").click();
    await expect(details.locator(".nr-drought-workspace-detail-panel, .nr-forecast-timeline")).toHaveCount(0);
    await expect(details.locator(".nr-forecast-archive-mode-section")).toBeVisible();
    await expect(details).toContainText("ค่าจากการพยากรณ์ ไม่ใช่ข้อมูลความเสียหายทางการ");
    await expect(details.locator(".nr-forecast-archive-target")).toContainText("ธ.ค. 2568");
    await expect(details.locator(".nr-forecast-archive-target")).toContainText("T+4");
    await details.locator("summary").click();

    await map.evaluate((element) => element.setAttribute("data-instance-probe", "same-map"));
    await page.locator(".nr-operational-disclosure > summary").filter({ hasText: /พื้นที่เกษตรและความพร้อมข้อมูล|ความพร้อมข้อมูลพื้นที่/ }).click();
    await expect(page.getByText(/67,347|8,081|พื้นที่ประเมินทั้งจังหวัด|ความเชื่อมั่นข้อมูลเกษตร/)).toHaveCount(0);
    if (scope === "province") await expect(page.locator(".nr-agri-impact-module")).toHaveCount(0);
    await page.getByRole("button", { name: "ดูความพร้อมบนแผนที่" }).click();
    await expect(workspace.getByRole("heading", { name: "แผนที่ความพร้อมข้อมูลพื้นที่" })).toBeVisible();
    await expect(workspace.locator(".has-forecast-archive-map")).toHaveCount(0);
    await expect(page.locator(".nr-map-svg")).toHaveCount(1);
    await expect(map).toHaveAttribute("data-instance-probe", "same-map");
    await page.getByRole("button", { name: "กลับแผนที่พยากรณ์" }).click();
    await expect(workspace.locator(".has-forecast-archive-map")).toHaveCount(1);
    await expect(map).toHaveAttribute("data-instance-probe", "same-map");
    await expect(workspace.getByRole("tab", { name: /T\+4/ })).toHaveAttribute("aria-selected", "true");
    if (scope === "subdistrict") {
      await expect(chart).toHaveCount(0);
      await page.locator(".nr-operational-disclosure > summary").filter({ hasText: /พื้นที่เกษตรและความพร้อมข้อมูล|ความพร้อมข้อมูลพื้นที่/ }).click();
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
      await page.screenshot({ path: testInfo.outputPath("subdistrict-without-count-trend.png"), fullPage: true, scale: "css" });
    }
  });
}

test("area navigation retains the selected vintage and offers sibling subdistricts", async ({ page }, testInfo) => {
  await page.goto("/drought?target=2025-09&horizon=4");
  const filters = page.locator(".nr-operational-filters");
  await filters.getByRole("combobox", { name: /^อำเภอ/ }).click();
  await page.getByRole("option", { name: "ด่านขุนทด", exact: true }).click();
  await expect(page).toHaveURL(/dan-khun-thot\?mapLayer=forecast-archive&target=2025-09&horizon=4/);
  await filters.getByRole("combobox", { name: /^ตำบล/ }).click();
  await page.getByRole("option", { name: "บ้านเก่า", exact: true }).click();
  await expect(page).toHaveURL(/t-300806\?mapLayer=forecast-archive&target=2025-09&horizon=4/);
  await expect(filters.getByRole("combobox", { name: /^ตำบล/ })).toContainText("บ้านเก่า");
  await page.getByRole("button", { name: "กลับอำเภอ" }).click();
  await expect(page).toHaveURL(/dan-khun-thot\?mapLayer=forecast-archive&target=2025-09&horizon=4/);
  await expect(filters.getByRole("combobox", { name: /^ระยะพยากรณ์/ })).toContainText("T+4");
  await page.getByRole("button", { name: "กลับจังหวัด", exact: true }).click();
  await expect(page).toHaveURL(/\/drought\?mapLayer=forecast-archive&target=2025-09&horizon=4$/);
  await expect(page.locator(".nr-drought-compact-workspace.is-province")).toBeVisible();
  await expect(filters.getByRole("combobox", { name: /^ระยะพยากรณ์/ })).toContainText("T+4");

  await page.goto("/khon-buri?target=2025-12&horizon=4");
  await expect(page.getByRole("heading", { name: /ภัยแล้ง.*ครบุรี/, level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "กลับจังหวัด", exact: true }).click();
  await expect(page).toHaveURL(/\/drought\?mapLayer=forecast-archive&target=2025-12&horizon=4$/);
  await expect(page.locator(".nr-drought-compact-workspace.is-province")).toBeVisible();
  await expect(page.locator(".nr-map-shape")).toHaveCount(289);
  await expect(filters.getByRole("combobox", { name: /^อำเภอ/ })).toContainText("ทุกอำเภอ");
  await expect(filters.getByRole("combobox", { name: /^ระยะพยากรณ์/ })).toContainText("T+4");
  await page.screenshot({ path: testInfo.outputPath("district-back-to-drought.png"), scale: "css" });
  await page.getByRole("button", { name: "ภาพรวมจังหวัด", exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/");
});

test("tablet orientation keeps T+ above usable chart and map", async ({ page }) => {
  for (const [width, height] of [[1024, 768], [768, 1024]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/drought");
    const map = page.locator(".nr-drought-workspace-map-card");
    await expect(map.locator(".nr-map-shape")).toHaveCount(289);
    const m = (await map.boundingBox())!;
    const chart = (await page.locator(".nr-drought-workspace-chart-card").boundingBox())!;
    const tabs = (await page.locator(".nr-drought-workspace-horizon").boundingBox())!;
    expect(tabs.y + tabs.height).toBeLessThan(chart.y);
    expect(m.width).toBeGreaterThan(400);
    if (width > height) expect(m.y).toBe(chart.y);
    else expect(chart.y + chart.height).toBeLessThan(m.y);
  }
});
