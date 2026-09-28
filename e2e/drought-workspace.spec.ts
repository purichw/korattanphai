import { expect, test, fillAuthForm } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await fillAuthForm(page);
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page.locator('.sidebar-account .account-trigger')).toHaveCount(1);
});

for (const [scope, path] of [["province", "/drought"], ["district", "/dan-khun-thot"], ["subdistrict", "/dan-khun-thot/t-300806"]]) {
  test(`compact ${scope} shares filters, all stats, and a single map without readiness`, async ({ page }, testInfo) => {
    await page.goto(`${path}?mapLayer=forecast-archive&target=2025-12&horizon=1`);
    const workspace = page.locator(`.nr-drought-compact-workspace.is-${scope}`);
    const filters = page.locator(".nr-operational-filters");
    await expect(workspace).toBeVisible();
    await expect(page.locator(".nr-data-transparency, .nr-forecast-overview-source")).toHaveCount(0);
    await expect(page.getByText(/^(แหล่งข้อมูลและความสด|ข้อจำกัดสำคัญ)$/)).toHaveCount(0);
    await expect(filters.getByRole("combobox")).toHaveCount(3);
    await expect(filters.locator(".nr-fixed-filter")).toHaveText(["ภัยภัยแล้ง", "พืชข้าว"]);
    await expect(workspace.locator(".nr-drought-workspace-context .is-crop")).toContainText("ข้าว");
    if (scope === "subdistrict") {
      await expect(workspace.locator(".nr-drought-workspace-kpis .metric-card")).toHaveCount(1);
      await expect(workspace.locator(".nr-drought-workspace-kpis")).toContainText("เสี่ยงปานกลาง");
      await expect(page.locator(".nr-operational-forecast-summary, .nr-operational-attention-list")).toHaveCount(0);
    } else {
      await expect(workspace.locator(".nr-drought-workspace-kpis .is-coverage")).toContainText(scope === "province" ? "117/289" : "6/16");
      await expect(workspace.locator(".nr-drought-workspace-kpis .is-coverage .metric-card-detail")).toHaveText(scope === "province" ? "40% ของจำนวนตำบลทั้งหมด" : "38% ของจำนวนตำบลทั้งหมด");
      await expect(workspace.locator(".nr-drought-workspace-kpis .is-out-of-scope")).toBeVisible();
      await expect(page.locator(".nr-operational-forecast-summary .metric-card-value")).toHaveText("100%");
      await expect(page.locator(".nr-operational-forecast-summary")).not.toHaveClass(/has-risk|is-danger/);
    }
    await expect(page.getByText("สถานการณ์ภัยแล้งตามข้อมูลพื้นที่", { exact: true })).toHaveCount(0);
    const chart = workspace.locator(".nr-drought-workspace-chart-card");
    await expect(chart).toHaveCount(scope === "subdistrict" ? 0 : 1);
    const map = workspace.locator(".nr-map-svg");
    await expect(map.locator(".nr-map-shape")).toHaveCount(289);
    const cardGeometry = await page.locator(".nr-operational-card-heading").evaluateAll(cards => cards.map(card => {
      const frame = card.getBoundingClientRect();
      const copy = [...card.querySelectorAll(":scope > .nr-operational-card-copy, :scope > .metric-card-label, :scope > .metric-card-value, :scope > .metric-card-detail")];
      const rects = copy.map(node => node.getBoundingClientRect());
      const top = Math.min(...rects.map(rect => rect.top));
      const bottom = Math.max(...rects.map(rect => rect.bottom));
      return {
        text: card.textContent,
        horizontalOffsets: rects.map(rect => Math.abs(rect.x + rect.width / 2 - frame.x - frame.width / 2)),
        verticalOffset: Math.abs((top + bottom) / 2 - frame.y - frame.height / 2),
        alignment: copy.map(node => getComputedStyle(node).textAlign),
        overflow: card.scrollWidth > card.clientWidth + 1,
      };
    }));
    expect(cardGeometry.length).toBeGreaterThan(0);
    for (const card of cardGeometry) {
      expect(card.horizontalOffsets.every(offset => offset < 1), card.text ?? "card").toBe(true);
      expect(card.verticalOffset, card.text ?? "card").toBeLessThan(1);
      expect(card.alignment.every(alignment => alignment === "center")).toBe(true);
      expect(card.overflow).toBe(false);
    }
    const guidance = page.locator(".nr-operational-guidance");
    const guidanceTrigger = guidance.locator("summary");
    const initialUrl = page.url();
    await guidanceTrigger.focus();
    await guidanceTrigger.press("Enter");
    await expect(guidance).toHaveAttribute("open", "");
    await expect(guidance.locator(".nr-operational-disclosure-body")).toBeVisible();
    await expect(guidance.locator(".nr-operational-disclosure-body")).toHaveCSS("text-align", "start");
    await guidanceTrigger.press("Space");
    await expect(guidance).not.toHaveAttribute("open", "");
    await expect(guidanceTrigger).toBeFocused();
    expect(page.url()).toBe(initialUrl);
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
        firstKpi: box(".nr-drought-workspace-kpis .metric-card"),
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
      if (page.viewportSize()!.width >= 768) {
        expect(geometry.map.width / geometry.body.width).toBeGreaterThan(.6);
        expect(geometry.map.width / geometry.body.width).toBeLessThan(.71);
      } else {
        expect(geometry.map.width).toBeCloseTo(geometry.body.width, 0);
      }
      expect(geometry.firstKpi.width).toBeCloseTo(geometry.kpis.width, 0);
      expect(geometry.kpis.bottom).toBeLessThan(geometry.map.top);
    } else if (page.viewportSize()!.width > 900) {
      expect(geometry.chart.top).toBe(geometry.map.top);
      expect(geometry.map.height).toBeGreaterThanOrEqual(600);
      expect(geometry.chart.height).toBeLessThan(450);
      expect(geometry.kpis.top).toBeGreaterThan(geometry.chart.bottom);
      expect(geometry.kpis.left).toBe(geometry.chart.left);
      expect(geometry.kpis.bottom).toBeCloseTo(geometry.map.bottom, 0);
      await expect(workspace.locator(".nr-drought-kpi-heading")).toHaveText("สรุปเดือน ม.ค. 2569");
    } else {
      expect(geometry.kpis.bottom).toBeLessThan(geometry.chart.top);
      expect(geometry.chart.bottom).toBeLessThan(geometry.map.top);
    }
    await workspace.getByRole("tab", { name: /ล่วงหน้า 4 เดือน/ }).click();
    await expect(page).toHaveURL(/horizon=4/);
    await expect(workspace.getByRole("tab", { name: /ล่วงหน้า 4 เดือน/ })).toHaveAttribute("aria-selected", "true");
    await expect(workspace.locator(".nr-drought-workspace-context .is-issue strong")).toHaveText("ธ.ค. 2568");
    await expect(workspace.locator(".nr-drought-workspace-context .is-target strong")).toHaveText("เม.ย. 2569");
    if (scope !== "subdistrict") {
      await expect(workspace.locator(".nr-forecast-point-group.is-active")).toContainText("4 เดือน");
      await expect(workspace.locator(".nr-drought-kpi-heading")).toHaveText("สรุปเดือน เม.ย. 2569");
    }

    await expect(workspace.locator(".nr-drought-workspace-details, .nr-forecast-archive-mode-section")).toHaveCount(0);

    await expect(page.getByText(/67,347|8,081|พื้นที่ประเมินทั้งจังหวัด|ความเชื่อมั่นข้อมูลเกษตร/)).toHaveCount(0);
    await expect(page.locator(".nr-agri-impact-module")).toHaveCount(0);
    await expect(page.getByText(/ความพร้อมข้อมูล|ดูความพร้อมบนแผนที่/)).toHaveCount(0);
    await expect(page.locator(".nr-data-readiness-section, .nr-prediction-readiness, .nr-readiness-map-action, .nr-return-forecast")).toHaveCount(0);
    await expect(workspace.locator(".has-forecast-archive-map")).toHaveCount(1);
    await expect(page.locator(".nr-map-svg")).toHaveCount(1);
    await expect(workspace.getByRole("tab", { name: /ล่วงหน้า 4 เดือน/ })).toHaveAttribute("aria-selected", "true");
    if (scope === "subdistrict") {
      await expect(chart).toHaveCount(0);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await page.screenshot({ path: testInfo.outputPath(`${scope}-without-readiness.png`), fullPage: true, scale: "css" });
  });
}

for (const boundary of [
  {
    source: "2015-06", label: "มิ.ย. 2558",
    forecasts: ["ก.ค. 2558", "ส.ค. 2558", "ก.ย. 2558", "ต.ค. 2558", "พ.ย. 2558", "ธ.ค. 2558"],
    counts: [[60, 32, 25, 172], [1, 1, 115, 172], [0, 4, 113, 172]],
    homeRisks: ["moderate", "no-risk", "no-risk"],
  },
  {
    source: "2025-12", label: "ธ.ค. 2568",
    forecasts: ["ม.ค. 2569", "ก.พ. 2569", "มี.ค. 2569", "เม.ย. 2569", "พ.ค. 2569", "มิ.ย. 2569"],
    counts: [[0, 117, 0, 172], [65, 51, 1, 172], [59, 9, 49, 172]],
    homeRisks: ["moderate", "high", "high"],
  },
]) {
  test(`source month ${boundary.source} advances forecast dates while retaining the same source risks`, async ({ page }) => {
    await page.goto("/drought?mapLayer=forecast-archive&target=2025-12&horizon=1");
    const workspace = page.locator(".nr-drought-compact-workspace");
    const sourceSelect = page.getByRole("combobox", { name: /^เดือนตั้งต้น / });
    await expect(sourceSelect).toContainText("ธ.ค. 2568");
    if (boundary.source === "2015-06") {
      await sourceSelect.click();
      await expect(page.getByRole("option").last()).toHaveText(boundary.label);
      await page.getByRole("option", { name: boundary.label, exact: true }).click();
    }
    const tabs = workspace.locator(".nr-drought-workspace-horizon").getByRole("tab");
    await expect(tabs.locator("span")).toHaveText(boundary.forecasts);
    const chart = workspace.locator(".nr-drought-workspace-chart-card");
    await expect(chart.getByRole("heading", { name: "ตำบลเสี่ยงในแต่ละเดือน แยกตามระดับ", exact: true })).toBeVisible();
    await expect(chart.getByRole("img", { name: "แนวโน้มสัดส่วนตำบลเสี่ยงภัยแล้ง 6 เดือนข้างหน้า", exact: true })).toBeVisible();
    const context = workspace.locator(".nr-drought-workspace-context");
    const map = workspace.locator(".nr-drought-workspace-map-card");
    for (const [index, horizon] of [1, 4, 6].entries()) {
      const forecast = boundary.forecasts[horizon - 1];
      await tabs.filter({ hasText: `${horizon} เดือน` }).click();
      await expect(tabs.filter({ hasText: `${horizon} เดือน` })).toHaveAttribute("aria-selected", "true");
      await expect(page).toHaveURL(new RegExp(`target=${boundary.source}&horizon=${horizon}`));
      await expect(sourceSelect).toContainText(boundary.label);
      await expect(context.locator(".is-issue dt")).toHaveText("เดือนตั้งต้น (T)");
      await expect(context.locator(".is-issue strong")).toHaveText(boundary.label);
      await expect(context.locator(".is-target dt")).toHaveText("เดือนที่พยากรณ์");
      await expect(context.locator(".is-target strong")).toHaveText(forecast);
      await expect(chart.locator(".nr-forecast-point-group.is-active")).toContainText(forecast);
      await expect(map.locator(".nr-map-legend")).toContainText(`พยากรณ์ ${forecast}`);
      await expect(map.locator(".nr-map-shape")).toHaveCount(289);
      // Exact source-file counts ensure shifting dates never shifts the selected risk row.
      for (const [riskIndex, risk] of ["high", "moderate", "no-risk", "out-of-scope"].entries()) {
        await expect(map.locator(`.nr-map-shape.is-forecast-${risk}`)).toHaveCount(boundary.counts[index][riskIndex]);
      }
      const home = map.locator('.nr-map-shape[data-nr-subdistrict-code="300806"]');
      await expect(home).toHaveClass(new RegExp(`is-forecast-${boundary.homeRisks[index]}(?:\\s|$)`));
      await home.scrollIntoViewIfNeeded();
      await home.focus();
      const preview = map.locator(".nr-map-preview-card");
      await expect(preview).toBeVisible();
      await expect(preview.locator("dl > div").filter({ has: page.getByText("เดือนที่พยากรณ์", { exact: true }) }).locator("dd")).toHaveText(forecast);
      await expect(preview.locator("dl > div").filter({ has: page.getByText("เดือนตั้งต้น (T)", { exact: true }) }).locator("dd")).toHaveText(`${boundary.label} · ล่วงหน้า ${horizon} เดือน`);
    }
  });
}

test("all-null districts and tambons remain unavailable, never a green zero forecast", async ({ page }, testInfo) => {
  await page.goto("/ban-lueam?mapLayer=forecast-archive&target=2025-12&horizon=1");
  const workspace = page.locator(".nr-drought-compact-workspace");
  await expect(workspace.locator(".nr-forecast-unavailable")).toContainText("ไม่มีค่าพยากรณ์ให้เปรียบเทียบ");
  await expect(workspace.locator(".nr-drought-forecast-bar, .nr-drought-forecast-zero")).toHaveCount(0);
  await expect(workspace.locator(".is-coverage").last()).toContainText("0/4 ตำบล");
  await expect(workspace.locator(".nr-drought-workspace-kpis .is-no-risk")).toHaveClass(/is-muted/);
  await expect(page.locator(".nr-operational-forecast-summary")).toContainText("ไม่มีค่าพยากรณ์ในรอบนี้");
  await expect(page.locator(".nr-operational-attention-list")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("all-null-district.png"), fullPage: true, scale: "css" });
  await page.goto("/mueang-nakhon-ratchasima/t-300101?mapLayer=forecast-archive&target=2025-12&horizon=1");
  await expect(workspace.locator(".nr-drought-workspace-kpis")).toContainText("นอกขอบเขตการศึกษา");
  await expect(workspace.locator(".nr-drought-workspace-kpis .metric-card")).toHaveCount(1);
  await expect(page.locator(".nr-operational-attention-list, .nr-operational-forecast-summary")).toHaveCount(0);
  await expect(page.locator(".nr-map-shape")).toHaveCount(289);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("single-out-of-scope.png"), fullPage: true, scale: "css" });
});

test("area navigation retains the selected vintage and offers sibling subdistricts", async ({ page }, testInfo) => {
  await page.goto("/drought?mapLayer=forecast-archive&target=2025-09&horizon=4");
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
  await expect(page.getByRole("tab", { name: /ล่วงหน้า 4 เดือน/ })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "กลับจังหวัด", exact: true }).click();
  await expect(page).toHaveURL(/\/drought\?mapLayer=forecast-archive&target=2025-09&horizon=4$/);
  await expect(page.locator(".nr-drought-compact-workspace.is-province")).toBeVisible();
  await expect(page.getByRole("tab", { name: /ล่วงหน้า 4 เดือน/ })).toHaveAttribute("aria-selected", "true");

  await page.goto("/khon-buri?mapLayer=forecast-archive&target=2025-12&horizon=4");
  await expect(page.getByRole("heading", { name: /ภัยแล้ง.*ครบุรี/, level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "กลับจังหวัด", exact: true }).click();
  await expect(page).toHaveURL(/\/drought\?mapLayer=forecast-archive&target=2025-12&horizon=4$/);
  await expect(page.locator(".nr-drought-compact-workspace.is-province")).toBeVisible();
  await expect(page.locator(".nr-map-shape")).toHaveCount(289);
  await expect(filters.getByRole("combobox", { name: /^อำเภอ/ })).toContainText("ทุกอำเภอ");
  await expect(page.getByRole("tab", { name: /ล่วงหน้า 4 เดือน/ })).toHaveAttribute("aria-selected", "true");
  await page.screenshot({ path: testInfo.outputPath("district-back-to-drought.png"), scale: "css" });
  await page.getByRole("button", { name: "ภาพรวมจังหวัด", exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/");
});

test("tablet orientation keeps T+ above usable chart and map", async ({ page }) => {
  for (const [width, height] of [[1024, 768], [768, 1024]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/drought?mapLayer=forecast-archive");
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
