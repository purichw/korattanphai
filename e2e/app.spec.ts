import { expect, test, type Locator, type Page } from "@playwright/test";

const smokeUsername = "pointy";

async function openPrimaryNav(page: Page) {
  const menuToggle = page.getByRole("button", { name: "เปิดเมนูหลัก" });
  if (await menuToggle.isVisible()) await menuToggle.click();
  return page.locator(".primary-nav");
}

async function closePrimaryNav(page: Page) {
  const menuToggle = page.getByRole("button", { name: "ปิดเมนูหลัก" });
  if (await menuToggle.isVisible()) await menuToggle.click();
}

async function chooseSection(page: Page, name: string) {
  const nav = await openPrimaryNav(page);
  await nav.getByRole("button", { name, exact: true }).click();
}

async function loginAs(page: Page, username: string) {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "เข้าสู่ระบบ" })).toBeVisible();
  await page.getByLabel("ชื่อผู้ใช้").fill(username);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page.getByRole("button", { name: /บัญชีผู้ใช้/ })).toBeVisible();
}

async function expectProvinceOverviewHeading(page: Page) {
  const mobileHeading = page.locator(".nr-mobile-page-identity h1", { hasText: "จังหวัดนครราชสีมา" });
  if (await mobileHeading.isVisible()) {
    await expect(mobileHeading).toBeVisible();
    return;
  }
  await expect(page.locator(".nr-dashboard-heading h2", { hasText: "จังหวัดนครราชสีมา" })).toBeVisible();
}

async function openMobileFilterSheet(page: Page) {
  await page.getByRole("button", { name: "แก้ไขตัวกรองข้อมูล" }).click();
  const sheet = page.locator(".operational-filter-sheet");
  await expect(sheet).toBeVisible();
  return sheet;
}

async function closeMobileFilterSheet(page: Page) {
  const applyButton = page.getByRole("button", { name: "แสดงผล" });
  if (await applyButton.isVisible()) await applyButton.click();
}

async function readMapTransform(svg: Locator, transformSelector = ".map-transform-layer") {
  return svg.locator(transformSelector).evaluate((element) => {
    const values = (element.getAttribute("transform") ?? "")
      .match(/-?\d+(?:\.\d+)?/g)
      ?.map(Number);
    if (!values || values.length < 6) throw new Error("Map transform matrix was not readable");
    return { k: values[0], x: values[4], y: values[5] };
  });
}

async function installReactCommitCounter(page: Page) {
  await page.addInitScript({
    content: `
      (() => {
        window.__reactCommitCount = 0;
        window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
          supportsFiber: true,
          renderers: new Map(),
          inject(renderer) {
            const id = this.renderers.size + 1;
            this.renderers.set(id, renderer);
            return id;
          },
          onCommitFiberRoot() {
            window.__reactCommitCount = (window.__reactCommitCount || 0) + 1;
          },
          onCommitFiberUnmount() {}
        };
      })();
    `,
  });
}

async function startNrMapTransformProbe(page: Page) {
  await page.evaluate(() => {
    const layer = document.querySelector("g.nr-map-transform-layer");
    if (!layer) throw new Error("Nakhon Ratchasima transform layer was not found");
    const samples: string[] = [];
    let mutationCount = 0;
    let rafId = 0;
    const startCommitCount = ((window as unknown as { __reactCommitCount?: number }).__reactCommitCount ?? 0);
    const observer = new MutationObserver((records) => {
      mutationCount += records.filter((record) => record.type === "attributes" && record.attributeName === "transform").length;
    });
    observer.observe(layer, { attributes: true, attributeFilter: ["transform"] });
    const tick = () => {
      samples.push(layer.getAttribute("transform") ?? "");
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    (window as unknown as { __stopNrMapTransformProbe?: () => { distinctTransforms: number; mutationCount: number; reactCommits: number } }).__stopNrMapTransformProbe = () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
      return {
        distinctTransforms: new Set(samples).size,
        mutationCount,
        reactCommits: ((window as unknown as { __reactCommitCount?: number }).__reactCommitCount ?? 0) - startCommitCount,
      };
    };
  });
}

async function stopNrMapTransformProbe(page: Page) {
  return page.evaluate(() => {
    const stop = (window as unknown as {
      __stopNrMapTransformProbe?: () => { distinctTransforms: number; mutationCount: number; reactCommits: number };
    }).__stopNrMapTransformProbe;
    if (!stop) throw new Error("Nakhon Ratchasima transform probe was not started");
    return stop();
  });
}

async function centerInViewport(locator: Locator) {
  await locator.evaluate((element) => element.scrollIntoView({ block: "center", inline: "nearest" }));
}

async function expectPreviewInsideMap(preview: Locator, map: Locator) {
  const [previewBox, mapBox] = await Promise.all([preview.boundingBox(), map.boundingBox()]);
  expect(previewBox).not.toBeNull();
  expect(mapBox).not.toBeNull();
  if (!previewBox || !mapBox) return;
  expect(previewBox.x).toBeGreaterThanOrEqual(mapBox.x - 1);
  expect(previewBox.y).toBeGreaterThanOrEqual(mapBox.y - 1);
  expect(previewBox.x + previewBox.width).toBeLessThanOrEqual(mapBox.x + mapBox.width + 1);
  expect(previewBox.y + previewBox.height).toBeLessThanOrEqual(mapBox.y + mapBox.height + 1);
}

async function expectLocalProvinceBoundary(page: Page, localSvg: Locator) {
  const boundaryResponse = await page.request.get("/geodata/nakhon-ratchasima-boundary.geojson");
  expect(boundaryResponse.ok()).toBe(true);
  const boundary = await boundaryResponse.json();
  expect(boundary.features).toHaveLength(1);
  expect(boundary.features[0].properties.sourceFeatureCount).toBe(289);

  await expect(localSvg.locator(".nr-map-province-casing-layer")).toHaveCount(0);
  await expect(localSvg.locator("clipPath#nr-local-province-boundary-clip path")).toHaveCount(1);
  const boundaryLayer = localSvg.locator(".nr-map-province-boundary-layer");
  await expect(boundaryLayer).toHaveAttribute("clip-path", "url(#nr-local-province-boundary-clip)");
  await expect(boundaryLayer.locator("path")).toHaveCount(1);
  const boundaryStyle = await boundaryLayer.locator("path").evaluate((element) => {
    const styles = window.getComputedStyle(element);
    return {
      filter: styles.filter,
      strokeWidth: Number.parseFloat(styles.strokeWidth),
      vectorEffect: styles.getPropertyValue("vector-effect"),
    };
  });
  expect(boundaryStyle.filter).toBe("none");
  expect(boundaryStyle.strokeWidth).toBeGreaterThanOrEqual(3.4);
  expect(boundaryStyle.strokeWidth).toBeLessThanOrEqual(3.8);
  expect(boundaryStyle.vectorEffect).toBe("non-scaling-stroke");
}

async function boundingBoxOrThrow(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  if (!box) throw new Error("Expected locator to have a visible bounding box");
  return box;
}

async function clickSvgPathFillPoint(page: Page, locator: Locator, useTouch: boolean) {
  await centerInViewport(locator);
  const point = await locator.evaluate((element) => {
    const path = element as SVGGeometryElement;
    const svg = path.ownerSVGElement;
    const ctm = path.getScreenCTM();
    if (!svg || !ctm) throw new Error("SVG geometry is not clickable");
    const box = path.getBBox();
    const columns = 96;
    const rows = 96;
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    let bestPoint: { x: number; y: number } | null = null;
    let bestDistance = Infinity;

    for (let row = 1; row < rows; row += 1) {
      for (let column = 1; column < columns; column += 1) {
        const candidate = svg.createSVGPoint();
        candidate.x = box.x + (box.width * column) / columns;
        candidate.y = box.y + (box.height * row) / rows;
        if (path.isPointInFill(candidate)) {
          const screenPoint = candidate.matrixTransform(ctm);
          const topElement = document.elementFromPoint(screenPoint.x, screenPoint.y);
          if (topElement?.closest("[data-province-id], [data-nr-subdistrict-code]") === element) {
            const distance = Math.hypot(candidate.x - centerX, candidate.y - centerY);
            if (distance < bestDistance) {
              bestPoint = { x: screenPoint.x, y: screenPoint.y };
              bestDistance = distance;
            }
          }
        }
      }
    }

    if (bestPoint) return bestPoint;
    throw new Error("No unambiguous clickable fill point found for SVG path");
  });

  if (useTouch) {
    await locator.dispatchEvent("pointerdown", {
      bubbles: true,
      button: 0,
      buttons: 1,
      cancelable: true,
      clientX: point.x,
      clientY: point.y,
      pointerId: 1,
      pointerType: "touch",
    });
    await locator.dispatchEvent("pointerup", {
      bubbles: true,
      button: 0,
      buttons: 0,
      cancelable: true,
      clientX: point.x,
      clientY: point.y,
      pointerId: 1,
      pointerType: "touch",
    });
    await locator.dispatchEvent("click", {
      bubbles: true,
      button: 0,
      cancelable: true,
      clientX: point.x,
      clientY: point.y,
    });
  } else {
    await page.mouse.click(point.x, point.y);
  }
}

test("login route accepts only the two allowed usernames without listing them", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "เข้าสู่ระบบ" })).toBeVisible();
  await expect(page.getByText("Pointy")).toHaveCount(0);
  await expect(page.getByText("Somsak")).toHaveCount(0);

  await page.getByLabel("ชื่อผู้ใช้").fill("someone");
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page.getByRole("alert")).toContainText("ไม่พบชื่อผู้ใช้นี้");
  await expect(page.getByText("Pointy")).toHaveCount(0);
  await expect(page.getByText("Somsak")).toHaveCount(0);

  await page.getByLabel("ชื่อผู้ใช้").fill("pointy");
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page.getByRole("button", { name: /บัญชีผู้ใช้ เจ้าหน้าที่เกษตรจังหวัด/ })).toBeVisible();

  await page.getByRole("button", { name: /บัญชีผู้ใช้/ }).click();
  await page.getByRole("menuitem", { name: /ออกจากระบบ/ }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("ชื่อผู้ใช้").fill("SOMSAK");
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page.getByRole("button", { name: /บัญชีผู้ใช้ เจ้าหน้าที่เกษตรจังหวัด/ })).toBeVisible();
});

test("Nakhon Ratchasima-only shell opens the provincial overview with nested drought nav", async ({ page }) => {
  await loginAs(page, smokeUsername);

  await expect(page).toHaveURL(/\/$/);
  await expect(page).toHaveTitle(/Korat Tan Phai/);
  await expectProvinceOverviewHeading(page);
  const accountTrigger = page.getByRole("button", { name: /บัญชีผู้ใช้/ });
  await expect(accountTrigger).toBeVisible();
  await expect(page.locator(".topbar .login-session-chip")).toHaveCount(0);
  await expect(page.locator(".topbar .persona-select")).toHaveCount(0);
  await expect(page.locator(".topbar .secondary-button")).toHaveCount(0);
  await accountTrigger.click();
  const accountMenu = page.getByRole("menu", { name: "บัญชีผู้ใช้" });
  await expect(accountMenu).toContainText("บัญชีผู้ใช้งาน");
  await expect(accountMenu).toContainText("เจ้าหน้าที่เกษตรจังหวัด");
  await expect(accountMenu.getByRole("menuitemradio", { name: /เจ้าหน้าที่เกษตรอำเภอ/ })).toBeVisible();
  await expect(accountMenu).not.toContainText(".demo");
  await expect(accountMenu).not.toContainText("หน่วยงานน้ำและชลประทาน");
  await expect(accountMenu.getByRole("menuitem", { name: /คืนค่าข้อมูลเริ่มต้น/ })).toBeVisible();
  await expect(accountMenu.getByRole("menuitem", { name: /ออกจากระบบ/ })).toBeVisible();
  await accountMenu.getByRole("menuitemradio", { name: /เจ้าหน้าที่เกษตรอำเภอ/ }).click();
  await expect(page.getByRole("button", { name: /บัญชีผู้ใช้ เจ้าหน้าที่เกษตรอำเภอ/ })).toBeVisible();
  await page.getByRole("button", { name: /บัญชีผู้ใช้/ }).click();
  await page.getByRole("menuitemradio", { name: /เจ้าหน้าที่เกษตรจังหวัด/ }).click();
  const overviewViewport = page.viewportSize();
  const isPhoneLayout = (overviewViewport?.width ?? 1440) <= 720;
  if (isPhoneLayout) {
    await expect(page.getByRole("img", { name: "แผนที่ตำบลจังหวัดนครราชสีมา" })).toBeVisible();
  } else {
    await expect(page.getByRole("heading", { name: "แผนที่สถานการณ์ภัยแล้ง" })).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: "บริบทความเสี่ยงภัยแล้ง" })).toHaveCount(0);
  await expect(page.getByText("ความเชื่อมั่นของข้อมูล").first()).toBeVisible();
  const archiveEntry = page.locator(".nr-forecast-archive-entry");
  await expect(archiveEntry).toBeVisible();
  await expect(archiveEntry).toContainText("คลังพยากรณ์ย้อนหลัง");
  await expect(archiveEntry).toContainText("ดูคำพยากรณ์ที่โมเดลเคยออกไว้");
  await expect(archiveEntry).toContainText("T+1–T+6");
  await expect(archiveEntry).toContainText("142/289 ตำบล");
  await expect(archiveEntry).toContainText("T+1");
  await expect(archiveEntry.getByRole("link", { name: /เปิดในหน้าภัยแล้ง/ })).toHaveAttribute(
    "href",
    "/drought?mapLayer=forecast-archive&target=2025-12&horizon=1",
  );
  await expect(archiveEntry.getByRole("combobox")).toHaveCount(0);
  const overviewCockpitBox = await boundingBoxOrThrow(page.locator(".nr-overview-cockpit"));
  const overviewSummaryRailBox = await boundingBoxOrThrow(page.locator(".nr-overview-summary-rail"));
  const overviewMapBox = await boundingBoxOrThrow(page.locator(".nr-dashboard-map-card.is-overview-map"));
  const overviewWorkspaceBox = await boundingBoxOrThrow(page.locator(".nr-workspace"));
  if (isPhoneLayout) {
    expect(overviewMapBox.y).toBeLessThan(overviewSummaryRailBox.y);
    expect(overviewSummaryRailBox.y).toBeLessThan((overviewViewport?.height ?? 844) + 12);
  } else {
    expect(overviewCockpitBox.y).toBeLessThan(overviewWorkspaceBox.y + 220);
    expect(Math.abs(overviewMapBox.y - overviewSummaryRailBox.y)).toBeLessThan(4);
    expect(overviewMapBox.x).toBeLessThan(overviewSummaryRailBox.x);
    expect(overviewMapBox.width).toBeGreaterThan(overviewWorkspaceBox.width * 0.52);
    expect(overviewSummaryRailBox.width).toBeGreaterThan(overviewWorkspaceBox.width * 0.26);
  }
  const nav = await openPrimaryNav(page);
  await expect(nav.getByRole("button")).toHaveCount(2);
  await expect(nav.getByRole("button", { name: "ภาพรวม", exact: true })).toBeVisible();
  await expect(nav.getByRole("button", { name: "ภัยแล้ง", exact: true })).toBeVisible();
  await nav.getByRole("button", { name: "ภัยแล้ง", exact: true }).click();
  await expect(page).toHaveURL(/\/drought$/);
  await expect(page.getByRole("heading", { level: 1, name: "ภัยแล้ง" })).toBeVisible();
  await expect(page.getByRole("button", { name: "ภาพรวมจังหวัด" })).toBeVisible();
  await expect(page.getByRole("button", { name: "กลับภาพรวมจังหวัด" })).toHaveCount(0);
  await expect(page.locator(".nr-drought-page-header")).toBeVisible();
  await expect(page.locator(".nr-route-bar")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "คาดการณ์ภัยแล้ง 6 เดือน (T+1 ถึง T+6)" })).toBeVisible();
  await closePrimaryNav(page);
  await expect(page.locator(".nr-drought-dashboard")).toBeVisible();
  const droughtWorkspace = page.locator(".nr-drought-compact-workspace.is-province").first();
  const horizonTabs = droughtWorkspace.locator(".nr-drought-workspace-horizon .nr-forecast-archive-horizon-tabs");
  await expect(droughtWorkspace).toBeVisible();
  await expect(horizonTabs.getByRole("tab")).toHaveCount(6);
  await expect(horizonTabs.getByRole("tab", { name: /T\+1/ })).toHaveAttribute("aria-selected", "true");
  await expect(droughtWorkspace.getByRole("heading", { name: "แนวโน้มจำนวนตำบลที่เสี่ยงภัยแล้ง" })).toBeVisible();
  await expect(droughtWorkspace.locator(".nr-drought-workspace-chart-card .nr-forecast-point-group")).toHaveCount(6);
  await expect(droughtWorkspace.locator(".nr-drought-workspace-chart-card .nr-forecast-point-group.is-active")).toHaveCount(1);
  await expect(droughtWorkspace.locator(".nr-drought-workspace-chart-card .nr-drought-forecast-point-label", { hasText: "167" })).toHaveCount(3);
  await expect(droughtWorkspace.locator(".nr-drought-workspace-kpis")).toContainText("เสี่ยงสูง");
  await expect(droughtWorkspace.locator(".nr-drought-workspace-kpis")).toContainText("ไม่มี/นอกขอบเขต");
  await expect(page.locator(".nr-drought-secondary-grid .nr-research-attention")).toBeVisible();
  await expect(page.locator(".nr-dashboard-module-grid .nr-follow-up-section")).toHaveCount(0);
  const viewport = page.viewportSize();
  const workspaceBox = await boundingBoxOrThrow(droughtWorkspace);
  const horizonBox = await boundingBoxOrThrow(horizonTabs);
  const chartBox = await boundingBoxOrThrow(droughtWorkspace.locator(".nr-drought-workspace-chart-card"));
  const mapBox = await boundingBoxOrThrow(droughtWorkspace.locator(".nr-drought-workspace-map-card"));
  const kpisBox = await boundingBoxOrThrow(droughtWorkspace.locator(".nr-drought-workspace-kpis"));
  const secondaryBox = await boundingBoxOrThrow(page.locator(".nr-drought-secondary-grid"));
  const archiveMode = droughtWorkspace.locator(".nr-forecast-archive-mode-section.is-province");
  await expect(archiveMode).toContainText("คำพยากรณ์ที่ใช้วาดแผนที่ย้อนหลัง");
  await expect(archiveMode).toContainText("ค่าจากการพยากรณ์ ไม่ใช่ข้อมูลความเสียหายทางการ");
  await expect(archiveMode).toContainText("142/289 ตำบล");
  await expect(archiveMode).toContainText("นอกขอบเขต147 ตำบล");
  await expect(archiveMode.getByRole("tab")).toHaveCount(0);
  const mapToolbar = droughtWorkspace.locator(".nr-drought-workspace-map-card .nr-local-map-criteria");
  const mapControls = droughtWorkspace.locator(".nr-drought-workspace-map-card .nr-map-controls");
  await expect(page.getByRole("heading", { name: "แผนที่พยากรณ์ความเสี่ยงภัยแล้ง" })).toBeVisible();
  await expect(mapToolbar.getByRole("combobox")).toHaveCount(2);
  await expect(mapToolbar.getByRole("combobox", { name: "เดือนเป้าหมายบนแผนที่พยากรณ์ภัยแล้ง" })).toBeVisible();
  await expect(mapToolbar.getByRole("combobox", { name: "สถานะพยากรณ์ภัยแล้ง" })).toBeVisible();
  await expect(mapToolbar.locator(".nr-local-map-filter-status")).toHaveCount(0);
  await expect(mapToolbar).not.toContainText(/\/.*ตำบล/);
  await horizonTabs.getByRole("tab", { name: /T\+2/ }).click();
  await expect(horizonTabs.getByRole("tab", { name: /T\+2/ })).toHaveAttribute("aria-selected", "true");
  await expect(archiveMode).toContainText("142/289 ตำบล");
  await expect(archiveMode).toContainText("เสี่ยงปานกลาง120 ตำบล");
  await mapToolbar.getByRole("combobox", { name: "เดือนเป้าหมายบนแผนที่พยากรณ์ภัยแล้ง" }).click();
  await page.getByRole("option", { name: /เป้าหมาย · ก.ย. 2568/ }).click();
  await expect(archiveMode).toContainText("117/289 ตำบล");
  await expect(archiveMode).toContainText("เสี่ยงปานกลาง17 ตำบล");
  await mapToolbar.getByRole("combobox", { name: "สถานะพยากรณ์ภัยแล้ง" }).click();
  await page.getByRole("option", { name: "ไม่มีความเสี่ยง" }).click();
  await expect(mapToolbar.locator(".nr-local-map-filter-status")).toContainText(/แสดง .* จาก .* ตำบล|ไม่พบตำบลที่ตรงกับตัวกรอง/);
  await mapToolbar.getByRole("button", { name: "รีเซ็ต" }).click();
  await expect(mapToolbar.locator(".nr-local-map-filter-status")).toHaveCount(0);
  if ((viewport?.width ?? 0) >= 1180) {
    expect(horizonBox.y).toBeGreaterThanOrEqual(workspaceBox.y);
    expect(horizonBox.y).toBeLessThan(mapBox.y);
    expect(Math.abs(mapBox.y - kpisBox.y)).toBeLessThan(8);
    expect(chartBox.x).toBeGreaterThan(mapBox.x + mapBox.width - 2);
    expect(kpisBox.y).toBeLessThan(chartBox.y);
    expect(kpisBox.x).toBeGreaterThan(mapBox.x + mapBox.width - 2);
    const toolbarBox = await boundingBoxOrThrow(mapToolbar);
    const controlsBox = await boundingBoxOrThrow(mapControls);
    expect(toolbarBox.x + toolbarBox.width).toBeLessThanOrEqual(controlsBox.x - 4);
    expect(controlsBox.height).toBeGreaterThan(controlsBox.width * 2);
  } else {
    expect(horizonBox.y).toBeLessThan(chartBox.y);
    expect(kpisBox.y).toBeLessThan(chartBox.y);
  }
  expect(secondaryBox.y).toBeGreaterThan(workspaceBox.y);
  const droughtNav = await openPrimaryNav(page);
  await expect(droughtNav.getByRole("button", { name: "ภัยแล้ง", exact: true })).toHaveClass(/active/);
  await closePrimaryNav(page);
  await page.getByRole("button", { name: "ภาพรวมจังหวัด" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".brand-lockup strong")).toHaveCount(0);
  await expect(page.locator(".brand-lockup span")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "EN", exact: true })).toHaveCount(0);
  await closePrimaryNav(page);
  await expect(page.locator(".topbar-logo")).toHaveCount(0);
  await expect(page.getByText("ข่าวกรองความเสี่ยงเกษตรและการเตือนภัยล่วงหน้าระดับประเทศ")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "กลับแผนที่ประเทศ" })).toHaveCount(0);
  await expect(page.locator(".nr-dashboard-tabs")).toHaveCount(0);
  await expect(page.locator(".brand-mark img")).toHaveAttribute("src", "/brand/korat-tan-phai-sidebar-logo.webp");
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("sizes", "512x512");
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
    "href",
    "/brand/korat-tan-phai-favicon.png?v=3",
  );
  await expectProvinceOverviewHeading(page);
});

test("removed water route no longer renders the province water page", async ({ page }) => {
  await loginAs(page, smokeUsername);
  await page.goto("/water");

  await expect(page.getByRole("heading", { name: "ไม่พบพื้นที่" })).toBeVisible();
  await expect(page.getByRole("button", { name: "กลับภาพรวม" })).toBeVisible();
  await expect(page.getByText("แผนที่ฝนย้อนหลังในชุดข้อมูล")).toHaveCount(0);
  await expect(page.getByText("พยากรณ์ฝน")).toHaveCount(0);
  await expect(page.locator(".nr-dashboard-tabs")).toHaveCount(0);
});

test("drought forecast archive components are shared across province, district, and subdistrict maps", async ({ page }) => {
  await loginAs(page, smokeUsername);

  await page.goto("/drought?mapLayer=forecast-archive&horizon=1");
  const provinceWorkspace = page.locator(".nr-drought-compact-workspace.is-province").first();
  await expect(provinceWorkspace).toBeVisible();
  await expect(provinceWorkspace.locator(".nr-drought-workspace-horizon").getByRole("tab")).toHaveCount(6);
  await expect(provinceWorkspace.locator(".nr-forecast-archive-mode-section.is-province")).toContainText("คำพยากรณ์ที่ใช้วาดแผนที่ย้อนหลัง");
  await expect(provinceWorkspace.locator(".nr-forecast-archive-mode-section.is-province").getByRole("tab")).toHaveCount(0);
  await expect(provinceWorkspace.getByRole("heading", { name: "แผนที่พยากรณ์ความเสี่ยงภัยแล้ง" })).toBeVisible();
  await expect(provinceWorkspace.locator(".nr-drought-workspace-map-card .nr-local-map-criteria").getByRole("combobox")).toHaveCount(2);

  await page.goto("/dan-khun-thot?mapLayer=forecast-archive&horizon=1");
  await expect(page.getByRole("heading", { name: "ด่านขุนทด", exact: true })).toBeVisible();
  const districtWorkspace = page.locator(".nr-drought-compact-workspace.is-district").first();
  await expect(districtWorkspace).toBeVisible();
  await expect(districtWorkspace.locator(".nr-drought-workspace-horizon").getByRole("tab")).toHaveCount(6);
  await expect(districtWorkspace.locator(".nr-forecast-archive-mode-section.is-district")).toContainText("พยากรณ์ย้อนหลังระดับอำเภอ");
  await expect(districtWorkspace.locator(".nr-forecast-archive-mode-section.is-district")).toContainText("6/16 ตำบล");
  await expect(districtWorkspace.locator(".nr-forecast-archive-mode-section.is-district")).toContainText("นอกขอบเขต10 ตำบล");
  await expect(districtWorkspace.locator(".nr-forecast-archive-mode-section.is-district")).not.toContainText("Weighted signal index");
  await expect(districtWorkspace.locator(".nr-forecast-archive-mode-section.is-district").getByRole("tab")).toHaveCount(0);
  await expect(districtWorkspace.getByRole("heading", { name: "แผนที่พยากรณ์ความเสี่ยงภัยแล้งระดับตำบล" })).toBeVisible();
  await expect(districtWorkspace.locator(".nr-drought-workspace-map-card .nr-local-map-criteria").getByRole("combobox")).toHaveCount(2);

  await page.goto("/dan-khun-thot/t-300806?mapLayer=forecast-archive&target=2025-12&horizon=1");
  await expect(page.getByRole("heading", { name: "บ้านเก่า", exact: true })).toBeVisible();
  const subdistrictWorkspace = page.locator(".nr-drought-compact-workspace.is-subdistrict").first();
  await expect(subdistrictWorkspace).toBeVisible();
  await expect(subdistrictWorkspace.locator(".nr-drought-workspace-horizon").getByRole("tab")).toHaveCount(6);
  await expect(subdistrictWorkspace.locator(".nr-forecast-archive-mode-section.is-subdistrict")).toContainText("พยากรณ์ย้อนหลังของตำบล");
  await expect(subdistrictWorkspace.locator(".nr-forecast-archive-mode-section.is-subdistrict")).toContainText("ค่าที่พยากรณ์");
  await expect(subdistrictWorkspace.locator(".nr-forecast-archive-mode-section.is-subdistrict")).toContainText("1 · เสี่ยงปานกลาง");
  await expect(subdistrictWorkspace.locator(".nr-forecast-archive-mode-section.is-subdistrict").getByRole("tab")).toHaveCount(0);
  await expect(subdistrictWorkspace.getByRole("heading", { name: "แผนที่พยากรณ์ความเสี่ยงภัยแล้งของตำบล" })).toBeVisible();
  await expect(subdistrictWorkspace.locator(".nr-drought-workspace-map-card .nr-local-map-criteria").getByRole("combobox")).toHaveCount(2);
});

test("Nakhon Ratchasima map dropdown wheel scroll does not zoom the map", async ({ page }) => {
  await page.setViewportSize({ width: 1172, height: 960 });
  await loginAs(page, smokeUsername);
  await page.goto("/drought?mapLayer=forecast-archive&target=2025-12&horizon=1");

  const viewport = page.viewportSize();
  const isDesktopLayout = (viewport?.width ?? 0) > 720;
  const mapCard = page.locator(".nr-drought-workspace-map-card").first();
  const mapToolbar = mapCard.locator(".nr-local-map-criteria");
  const localSvg = page.getByRole("img", { name: "แผนที่ตำบลจังหวัดนครราชสีมา" });
  await expect(mapCard.getByRole("heading", { name: "แผนที่พยากรณ์ความเสี่ยงภัยแล้ง" })).toBeVisible();
  await expect(localSvg.locator(".nr-map-shape")).toHaveCount(289);
  await page.waitForTimeout(220);

  await mapToolbar.getByRole("combobox", { name: "เดือนเป้าหมายบนแผนที่พยากรณ์ภัยแล้ง" }).click();
  const targetMonthMenu = page.locator(".app-select-menu").last();
  const targetMonthOptions = targetMonthMenu.locator(".app-select-options");
  await expect(targetMonthMenu).toBeVisible();

  const transformBeforeDropdownWheel = await readMapTransform(localSvg, ".nr-map-transform-layer");
  const dropdownScrollBefore = await targetMonthMenu.evaluate((menu) => {
    const options = menu.querySelector(".app-select-options") as HTMLElement | null;
    return { menu: menu.scrollTop, options: options?.scrollTop ?? 0 };
  });
  const targetMonthOptionsBox = await boundingBoxOrThrow(targetMonthOptions);
  const wheelY = Math.min(
    targetMonthOptionsBox.y + Math.min(96, targetMonthOptionsBox.height / 2),
    (viewport?.height ?? 960) - 24,
  );
  await page.mouse.move(
    targetMonthOptionsBox.x + targetMonthOptionsBox.width / 2,
    wheelY,
  );
  await page.mouse.wheel(0, 420);
  await page.waitForTimeout(220);

  const dropdownScrollAfter = await targetMonthMenu.evaluate((menu) => {
    const options = menu.querySelector(".app-select-options") as HTMLElement | null;
    return { menu: menu.scrollTop, options: options?.scrollTop ?? 0 };
  });
  const transformAfterDropdownWheel = await readMapTransform(localSvg, ".nr-map-transform-layer");

  if (isDesktopLayout) {
    expect(Math.max(dropdownScrollAfter.menu - dropdownScrollBefore.menu, dropdownScrollAfter.options - dropdownScrollBefore.options)).toBeGreaterThan(0);
  }
  expect(transformAfterDropdownWheel.k).toBeCloseTo(transformBeforeDropdownWheel.k, 3);
  expect(transformAfterDropdownWheel.x).toBeCloseTo(transformBeforeDropdownWheel.x, 1);
  expect(transformAfterDropdownWheel.y).toBeCloseTo(transformBeforeDropdownWheel.y, 1);
});

test("custom dropdowns are app-rendered and keyboard operable", async ({ page }) => {
  await loginAs(page, smokeUsername);

  await expect(page.locator("select")).toHaveCount(0);

  const editFiltersButton = page.getByRole("button", { name: "แก้ไขตัวกรองข้อมูล" });
  const isMobileSummary = await editFiltersButton.isVisible();
  if (isMobileSummary) {
    await expect(page.locator(".operational-filter-mobile-summary")).toBeVisible();
    await expect(page.locator(".operational-filter-fields")).toBeHidden();
    await editFiltersButton.click();
    await expect(page.getByRole("dialog", { name: "ตัวกรองข้อมูล" })).toBeVisible();
  }

  const filters = isMobileSummary ? page.locator(".operational-filter-sheet") : page.locator(".control-band");
  const hazard = filters.getByRole("combobox", { name: /ภัย/ });
  await hazard.focus();
  await page.keyboard.press("Enter");
  const listboxId = await hazard.getAttribute("aria-controls");
  expect(listboxId).toBeTruthy();
  const menu = page.locator(`#${listboxId}`);
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("option").first()).toBeVisible();
  await expect(menu).toHaveCSS("font-family", /Google Sans/);
  await expect(menu).toContainText("ภัยแล้ง");
  await expect(menu).not.toContainText("น้ำหลาก");
  await expect(menu).not.toContainText("ฝนหนัก");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(hazard).not.toContainText("ทั้งหมด");
  await expect(hazard).toContainText("ภัยแล้ง");
  await expect(hazard).toHaveAttribute("aria-expanded", "false");

  const crop = filters.getByRole("combobox", { name: /พืช/ });
  await crop.click();
  const cropListboxId = await crop.getAttribute("aria-controls");
  expect(cropListboxId).toBeTruthy();
  const cropMenu = page.locator(`#${cropListboxId}`);
  await expect(cropMenu).toContainText("ข้าว");
  await expect(cropMenu).not.toContainText("ข้าวโพด");
  await expect(cropMenu).not.toContainText("มันสำปะหลัง");
  await expect(cropMenu).not.toContainText("อ้อย");
  await page.keyboard.press("Escape");
  await expect(crop).toHaveAttribute("aria-expanded", "false");
  if (isMobileSummary) {
    await page.keyboard.press("Escape");
    await expect(page.locator(".operational-filter-sheet")).toHaveCount(0);
  }
  await expect(page.locator(".nr-layer-control")).toHaveCount(0);
});

test.skip("national map preview, zoom, and pan keep Thailand inside the viewport", async ({ page }, testInfo) => {
  await loginAs(page, smokeUsername);

  await chooseSection(page, "แผนที่");
  const mapShell = page.locator(".map-page-grid .map-shell").first();
  const map = mapShell.locator(".map-canvas");
  const svg = map.getByRole("img", { name: "แผนที่ความเสี่ยงรายจังหวัดของประเทศไทย" });
  const preview = map.locator(".map-preview-card");
  const khonKaen = svg.getByRole("button", { name: /^ขอนแก่น/ });

  await expect(svg).toBeVisible();
  await expect(svg.locator(".neighbor-shape")).toHaveCount(5);
  await expect(svg.locator(".neighbor-border")).toHaveCount(5);
  await expect(svg.locator(".province-selection-halo")).toHaveCount(0);
  await expect(map.locator(".map-overlay-controls").getByTitle("ขยายแผนที่")).toBeVisible();
  await expect(mapShell.locator(".map-toolbar").getByTitle("ขยายแผนที่")).toHaveCount(0);
  const initialTransform = await readMapTransform(svg);

  if (testInfo.project.name === "mobile") {
    await clickSvgPathFillPoint(page, khonKaen, true);
    await expect(preview).toBeVisible();
    await expect(preview).toContainText("ขอนแก่น");
    await expect(preview).toContainText("ความเสี่ยงหลัก");
    await expect(preview).toContainText("พื้นที่เกษตรเสี่ยง");
    await expect(svg.locator(".province-preview-halo")).toHaveCount(1);
    await expect(svg.locator(".province-selection-halo")).toHaveCount(1);

    await map.tap({ position: { x: 16, y: 16 } });
    await expect(preview).toHaveCount(0);

    await clickSvgPathFillPoint(page, khonKaen, true);
  } else {
    await khonKaen.hover();
    await expect(preview).toBeVisible();
    await expect(preview).toContainText("ขอนแก่น");
    await expect(preview).toContainText("ความเสี่ยงหลัก");
    await expect(preview).toContainText("พื้นที่เกษตรเสี่ยง");
    await expect(svg.locator(".province-preview-halo")).toHaveCount(1);
    await khonKaen.click();
  }

  await page.waitForTimeout(260);
  await expect(svg.locator(".province-selection-halo")).toHaveCount(1);
  await expect(svg.locator(".province-selection-halo-outer")).toHaveCount(1);
  await expect(svg.locator(".province-selection-halo-inner")).toHaveCount(1);
  const selectedTransform = await readMapTransform(svg);
  expect(selectedTransform.k).toBeGreaterThan(initialTransform.k);
  expect(selectedTransform.k).toBeLessThanOrEqual(1.6);

  if (testInfo.project.name !== "mobile") {
    const wheelBox = await map.boundingBox();
    expect(wheelBox).not.toBeNull();
    if (!wheelBox) return;
    await page.mouse.move(wheelBox.x + wheelBox.width / 2, wheelBox.y + wheelBox.height / 2);

    const scrollBefore = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 40);
    await page.waitForTimeout(220);
    const wheelZoomOutTransform = await readMapTransform(svg);
    const scrollAfter = await page.evaluate(() => window.scrollY);
    expect(wheelZoomOutTransform.k).toBeLessThan(selectedTransform.k - 0.08);
    expect(scrollAfter).toBe(scrollBefore);

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.mouse.move(wheelBox.x + wheelBox.width / 2, wheelBox.y + wheelBox.height / 2);
    const pinchBefore = await readMapTransform(svg);
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -40);
    await page.keyboard.up("Control");
    await page.waitForTimeout(220);
    const pinchAfter = await readMapTransform(svg);
    expect(pinchAfter.k).toBeGreaterThanOrEqual(pinchBefore.k + 0.2);
  }

  await mapShell.getByTitle("ขยายแผนที่").click();
  await mapShell.getByTitle("ขยายแผนที่").click();
  await page.waitForTimeout(260);

  const box = await svg.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(450);
  await page.mouse.move(box.x + box.width + 1600, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(80);

  const transform = await readMapTransform(svg);
  const viewBox = await svg.evaluate((element) => element.getAttribute("viewBox") ?? "0 0 520 720");
  const [, , width, height] = viewBox.split(/\s+/).map(Number);

  expect(transform.k).toBeGreaterThan(1);
  expect(transform.x).toBeLessThanOrEqual(0);
  expect(transform.x).toBeGreaterThanOrEqual(width * (1 - transform.k) - 1);
  expect(transform.y).toBeLessThanOrEqual(0);
  expect(transform.y).toBeGreaterThanOrEqual(height * (1 - transform.k) - 1);

  const pageOverflow = await page.evaluate(() => ({
    scrollX: window.scrollX,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));

  expect(pageOverflow.scrollX).toBe(0);
  expect(pageOverflow.overflow).toBeLessThanOrEqual(1);
});

test.skip("national map preview stays actionable and opens the supported province workspace", async ({ page }, testInfo) => {
  await loginAs(page, smokeUsername);

  await chooseSection(page, "แผนที่");
  const mapShell = page.locator(".map-page-grid .map-shell").first();
  const map = mapShell.locator(".map-canvas");
  const svg = map.getByRole("img", { name: "แผนที่ความเสี่ยงรายจังหวัดของประเทศไทย" });
  const nakhonRatchasima = svg.getByRole("button", { name: /^นครราชสีมา/ });
  const preview = map.locator(".map-preview-card");

  await expect(svg).toBeVisible();
  if (testInfo.project.name === "mobile") {
    await clickSvgPathFillPoint(page, nakhonRatchasima, true);
  } else {
    await nakhonRatchasima.hover();
    await expect(preview).toBeVisible();
    const box = await preview.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  }

  await expect(preview).toBeVisible();
  await expect(preview).toContainText("นครราชสีมา");
  await preview.getByRole("button", { name: "ดูรายละเอียด →" }).click();
  await expect(page).toHaveURL(/\/nakhon-ratchasima$/);
  await expectProvinceOverviewHeading(page);
});

test("Nakhon Ratchasima province drill-down preserves code-based evidence and no-data wording", async ({ page }) => {
  test.setTimeout(60_000);

  await loginAs(page, smokeUsername);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "พืชที่ได้รับผลกระทบ" })).toHaveCount(0);
  await expectProvinceOverviewHeading(page);
  await expect(page.locator(".data-provenance-chip.is-real:visible").first()).toBeVisible();
  await expect(page.locator(".data-provenance-chip.is-synthetic:visible").first()).toBeVisible();
  await expect(page.locator(".data-provenance-chip.is-derived:visible").first()).toBeVisible();
  await expect(page.locator(".data-provenance-chip.is-proxy:visible").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "กลับแผนที่ประเทศ" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "ย้อนกลับหนึ่งระดับ" })).toHaveCount(0);
  const localMap = page.locator(".nr-map-panel").first();
  const localSvg = page.getByRole("img", { name: "แผนที่ตำบลจังหวัดนครราชสีมา" });
  await expect(localSvg).toBeVisible();
  await centerInViewport(localMap);
  await expect(localSvg.locator(".nr-map-context-layer path")).toHaveCount(289);
  await expect(localSvg.locator(".nr-map-shape")).toHaveCount(289);
  await expectLocalProvinceBoundary(page, localSvg);
  await expect(localMap.locator(".map-overlay-controls").getByTitle("ขยายแผนที่")).toBeVisible();
  const guardrail = page.locator(".nr-data-transparency-row.is-limitations").first();
  await expect(guardrail.getByText("ข้อจำกัดสำคัญ")).toBeVisible();
  await guardrail.locator("summary").click();
  await expect(guardrail).toContainText("การเชื่อมข้อมูลใช้รหัสจังหวัด/อำเภอ/ตำบลเท่านั้น");

  const nakhonRatchasimaFilters = page.locator(".nr-workspace > .control-band").first();
  const usesMobileFilterSheet = await page.getByRole("button", { name: "แก้ไขตัวกรองข้อมูล" }).isVisible();
  let provinceDistrictSelect: Locator;
  if (usesMobileFilterSheet) {
    await expect(nakhonRatchasimaFilters.locator(".operational-filter-mobile-summary")).toBeVisible();
    await expect(nakhonRatchasimaFilters.locator(".operational-filter-chip b", { hasText: "ทุกอำเภอ" })).toBeVisible();
    const sheet = await openMobileFilterSheet(page);
    await expect(sheet.getByRole("combobox", { name: "เลือกเดือน" })).toBeVisible();
    await expect(sheet.getByRole("combobox", { name: "เลือกภัย" })).toBeVisible();
    await expect(sheet.getByRole("combobox", { name: "เลือกพืช" })).toBeVisible();
    await expect(sheet.getByRole("combobox", { name: /^เลือกตำบล/ })).toHaveCount(0);
    provinceDistrictSelect = sheet.getByRole("combobox", { name: /^เลือกอำเภอ/ });
  } else {
    await expect(nakhonRatchasimaFilters.getByRole("combobox", { name: /^เดือน/ })).toBeVisible();
    await expect(nakhonRatchasimaFilters.getByRole("combobox", { name: /^ภัย/ })).toBeVisible();
    await expect(nakhonRatchasimaFilters.getByRole("combobox", { name: /^พืช/ })).toBeVisible();
    await expect(nakhonRatchasimaFilters.getByRole("combobox", { name: /^ตำบล/ })).toHaveCount(0);
    provinceDistrictSelect = nakhonRatchasimaFilters.getByRole("combobox", { name: /^อำเภอ/ });
  }
  await expect(provinceDistrictSelect).toBeVisible();
  await provinceDistrictSelect.click();
  const provinceDistrictListboxId = await provinceDistrictSelect.getAttribute("aria-controls");
  expect(provinceDistrictListboxId).toBeTruthy();
  const provinceDistrictMenu = page.locator(`#${provinceDistrictListboxId}`);
  await expect(provinceDistrictMenu).toContainText("วังน้ำเขียว");
  await expect(provinceDistrictMenu).toContainText("มีข้อมูล");
  await provinceDistrictMenu.locator('[data-select-value="3025"]').click();
  await expect(page).toHaveURL(/\/wang-nam-khiao$/);
  if (usesMobileFilterSheet) await closeMobileFilterSheet(page);
  await expect(page.getByRole("heading", { name: "วังน้ำเขียว", exact: true })).toBeVisible();
  const districtAreaFiltersFromProvince = page.locator(".nr-workspace > .control-band").first();
  let districtSubdistrictSelect: Locator;
  if (usesMobileFilterSheet) {
    await expect(districtAreaFiltersFromProvince.locator(".operational-filter-chip b", { hasText: "ทุกตำบล" })).toBeVisible();
    const sheet = await openMobileFilterSheet(page);
    districtSubdistrictSelect = sheet.getByRole("combobox", { name: /^เลือกตำบล/ });
  } else {
    districtSubdistrictSelect = districtAreaFiltersFromProvince.getByRole("combobox", { name: /^ตำบล/ });
  }
  await expect(districtSubdistrictSelect).toBeVisible();
  await districtSubdistrictSelect.click();
  const districtSubdistrictListboxId = await districtSubdistrictSelect.getAttribute("aria-controls");
  expect(districtSubdistrictListboxId).toBeTruthy();
  const districtSubdistrictMenu = page.locator(`#${districtSubdistrictListboxId}`);
  await expect(districtSubdistrictMenu).not.toContainText("สถานีในพื้นที่");
  await expect(districtSubdistrictMenu).not.toContainText("ใช้สถานีใกล้สุด");
  await districtSubdistrictMenu.locator('[data-select-value="302504"]').click();
  await expect(page).toHaveURL(/\/wang-nam-khiao\/t-302504$/);
  if (usesMobileFilterSheet) await closeMobileFilterSheet(page);
  await expect(page.getByRole("heading", { name: "อุดมทรัพย์", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "กลับอำเภอ" })).toBeVisible();
  await expect(page.getByRole("button", { name: "ย้อนกลับหนึ่งระดับ" })).toHaveCount(0);
  const subdistrictFilters = page.locator(".nr-workspace > .control-band").first();
  if (usesMobileFilterSheet) {
    await expect(subdistrictFilters.locator(".operational-filter-mobile-summary")).toBeVisible();
    await expect(subdistrictFilters.locator(".operational-filter-chip b", { hasText: "อุดมทรัพย์" })).toBeVisible();
    await expect(subdistrictFilters.getByRole("combobox")).toHaveCount(0);
  } else {
    await expect(subdistrictFilters.getByRole("combobox")).toHaveCount(3);
    await expect(subdistrictFilters.getByRole("combobox", { name: /^ตำบล/ })).toHaveCount(0);
  }
  await page.getByRole("button", { name: "กลับอำเภอ" }).click();
  await expect(page).toHaveURL(/\/wang-nam-khiao$/);
  await expect(page.getByRole("button", { name: "กลับจังหวัด" })).toBeVisible();
  await expect(page.getByRole("button", { name: "ย้อนกลับหนึ่งระดับ" })).toHaveCount(0);
  const districtFilters = page.locator(".nr-workspace > .control-band").first();
  if (usesMobileFilterSheet) {
    await expect(districtFilters.locator(".operational-filter-chip b", { hasText: "ทุกตำบล" })).toBeVisible();
  } else {
    await expect(districtFilters.getByRole("combobox", { name: /^ตำบล/ })).toBeVisible();
  }
  await page.getByRole("button", { name: "กลับจังหวัด" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: "กลับแผนที่ประเทศ" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "ย้อนกลับหนึ่งระดับ" })).toHaveCount(0);
  await expect(localSvg.locator(".nr-map-shape")).toHaveCount(289);
  await expect(page.locator(".nr-layer-control")).toHaveCount(0);
  await expect(localMap.locator(".nr-map-legend")).not.toContainText("มีสถานีฝนในพื้นที่");
  await expect(localMap.locator(".nr-map-legend")).not.toContainText("ใช้สถานีใกล้สุด");
  await expect(page.getByText("ปริมาณฝนและสถานี")).toHaveCount(0);
  await expect(page.getByText("ฝน 24 ชม.")).toHaveCount(0);
  await expect(page.getByText("ระดับน้ำ")).toHaveCount(0);
  await expect(page.getByText("ความพร้อมข้อมูลน้ำ")).toHaveCount(0);

  await page.goto("/nakhon-ratchasima/wang-nam-khiao/t-302504");
  await expect(page).toHaveURL(/\/nakhon-ratchasima\/wang-nam-khiao\/t-302504$/);
  await expect(page.getByRole("heading", { name: "อุดมทรัพย์", exact: true })).toBeVisible();
  await expect(page.getByText("หลักฐานสถานี")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "ช่องว่างของตำบล" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "แผนที่พยากรณ์ความเสี่ยงภัยแล้งของตำบล", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "กลับอำเภอ" })).toBeVisible();
  await expect(page.getByRole("button", { name: "ย้อนกลับหนึ่งระดับ" })).toHaveCount(0);
  await page.getByRole("button", { name: "กลับอำเภอ" }).click();
  await expect(page).toHaveURL(/\/wang-nam-khiao$/);
  await expect(page.getByRole("heading", { name: "วังน้ำเขียว", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^อุดมทรัพย์/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "กลับจังหวัด" })).toBeVisible();
  await expect(page.getByRole("button", { name: "ย้อนกลับหนึ่งระดับ" })).toHaveCount(0);
  await page.getByRole("button", { name: "กลับจังหวัด" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: "กลับแผนที่ประเทศ" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "ย้อนกลับหนึ่งระดับ" })).toHaveCount(0);

  await expect(page.locator(".nr-layer-control")).toHaveCount(0);
  await page.goto("/mueang-nakhon-ratchasima");
  await expect(page.getByRole("heading", { name: "เมืองนครราชสีมา", exact: true })).toBeVisible();
  await expect(localMap.getByText("ขอบเขตตำบล")).toHaveCount(0);

  await page.goto("/mueang-nakhon-ratchasima/t-300101");
  await expect(page.getByRole("heading", { name: "ในเมือง", exact: true })).toBeVisible();
  await expect(page.getByText("พื้นที่นี้ยังไม่มีหลักฐานเชิงลึกระดับท้องถิ่นในรอบข้อมูลนี้").first()).toBeVisible();
  await expect(page.getByText("ข้อมูลว่างไม่เท่ากับความเสี่ยงต่ำ").first()).toBeVisible();
  await expect(page.getByText("ยังไม่มีรายการพยากรณ์ภัยแล้งของพื้นที่นี้ในรอบข้อมูลพยากรณ์")).toBeVisible();
  await expect(page.getByText("หลักฐานสถานี")).toHaveCount(0);
  await expect(page.locator(".nr-subdistrict-gap-section")).toContainText("รายการที่ยังไม่มี");

  await page.goto("/");
  await expect(page.getByRole("button", { name: "กลับแผนที่ประเทศ" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "ย้อนกลับหนึ่งระดับ" })).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
  await expectProvinceOverviewHeading(page);
});

test("Nakhon Ratchasima local map preview actions stay layered and depth-aware", async ({ page }, testInfo) => {
  test.setTimeout(45_000);

  await loginAs(page, smokeUsername);
  await page.goto("/");

  const isMobile = testInfo.project.name === "mobile";
  const localMap = page.locator(".nr-map-panel").first();
  const localSvg = page.getByRole("img", { name: "แผนที่ตำบลจังหวัดนครราชสีมา" });
  const nakhonRatchasimaPreview = page.locator(".nr-map-preview-card");
  await expect(localSvg).toBeVisible();
  await expect(localSvg.locator(".nr-map-shape")).toHaveCount(289);
  await expectLocalProvinceBoundary(page, localSvg);
  await expect(localMap.getByText("ขอบเขตตำบล")).toHaveCount(0);

  await expect(page.locator(".nr-layer-control")).toHaveCount(0);
  await expect(localMap.locator(".nr-map-legend")).not.toContainText("มีสถานีฝนในพื้นที่");
  await expect(localMap.locator(".nr-map-legend")).not.toContainText("ใช้สถานีใกล้สุด");

  await centerInViewport(localMap);
  const initialTransform = await readMapTransform(localSvg, ".nr-map-transform-layer");
  if (!isMobile) {
    await localMap.getByTitle("ขยายแผนที่").click();
    await page.waitForTimeout(220);
    const preWheelZoomTransform = await readMapTransform(localSvg, ".nr-map-transform-layer");
    const wheelBox = await localMap.boundingBox();
    expect(wheelBox).not.toBeNull();
    if (!wheelBox) return;
    await page.mouse.move(wheelBox.x + wheelBox.width / 2, wheelBox.y + wheelBox.height / 2);

    const scrollBefore = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 40);
    await page.waitForTimeout(220);
    const wheelZoomOutTransform = await readMapTransform(localSvg, ".nr-map-transform-layer");
    const scrollAfter = await page.evaluate(() => window.scrollY);
    expect(wheelZoomOutTransform.k).toBeLessThan(preWheelZoomTransform.k - 0.08);
    expect(scrollAfter).toBe(scrollBefore);

    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -40);
    await page.keyboard.up("Control");
    await page.waitForTimeout(220);
    const wheelZoomTransform = await readMapTransform(localSvg, ".nr-map-transform-layer");
    expect(wheelZoomTransform.k).toBeGreaterThan(wheelZoomOutTransform.k + 0.12);
  }

  await localMap.getByTitle("ขยายแผนที่").click();
  await page.waitForTimeout(220);
  const buttonZoomTransform = await readMapTransform(localSvg, ".nr-map-transform-layer");
  expect(buttonZoomTransform.k).toBeGreaterThan(initialTransform.k);

  await localMap.getByTitle("กลับมุมมองพื้นที่นี้").click();
  await page.waitForTimeout(220);
  const resetTransform = await readMapTransform(localSvg, ".nr-map-transform-layer");
  expect(resetTransform.k).toBeCloseTo(initialTransform.k, 1);

  const wangNamKhiaoFeature = localSvg.locator('[data-nr-subdistrict-code="302505"]');
  await clickSvgPathFillPoint(page, wangNamKhiaoFeature, isMobile);
  await expect(nakhonRatchasimaPreview).toContainText("วังน้ำเขียว");
  await expect(nakhonRatchasimaPreview).toContainText("ไทยสามัคคี");
  await expect(nakhonRatchasimaPreview.getByRole("button", { name: "เปิดอำเภอนี้" })).toBeVisible();
  await expect(nakhonRatchasimaPreview.getByRole("button", { name: "เปิดตำบลนี้" })).toHaveCount(0);
  if (!isMobile) await expectPreviewInsideMap(nakhonRatchasimaPreview, localMap);
  const overlayOrder = await nakhonRatchasimaPreview.evaluate((card) => {
    const legend = document.querySelector(".nr-map-legend");
    return {
      legendZIndex: Number(window.getComputedStyle(legend as Element).zIndex),
      previewZIndex: Number(window.getComputedStyle(card).zIndex),
    };
  });
  expect(overlayOrder.previewZIndex).toBeGreaterThan(overlayOrder.legendZIndex);
  if (!isMobile) {
    await expect(localSvg.locator(".nr-map-selection-halo")).toHaveCount(1);
    await clickSvgPathFillPoint(page, wangNamKhiaoFeature, false);
    await expect(nakhonRatchasimaPreview).toHaveCount(0);
    await expect(localSvg.locator(".nr-map-selection-halo")).toHaveCount(0);
    await clickSvgPathFillPoint(page, wangNamKhiaoFeature, false);
    await expect(nakhonRatchasimaPreview).toContainText("วังน้ำเขียว");
    await expect(nakhonRatchasimaPreview.getByRole("button", { name: "เปิดอำเภอนี้" })).toBeVisible();
  }
  await nakhonRatchasimaPreview.getByRole("button", { name: "เปิดอำเภอนี้" }).click();

  await expect(page).toHaveURL(/\/wang-nam-khiao$/);
  await expect(page.getByRole("heading", { name: "วังน้ำเขียว", exact: true })).toBeVisible();
  const focusCasingStyle = await localSvg.locator(".nr-map-focus-casing-layer path").first().evaluate((element) => {
    const styles = window.getComputedStyle(element);
    return {
      strokeWidth: Number.parseFloat(styles.strokeWidth),
      vectorEffect: styles.getPropertyValue("vector-effect"),
    };
  });
  expect(focusCasingStyle.strokeWidth).toBeLessThanOrEqual(2.8);
  expect(focusCasingStyle.vectorEffect).toBe("non-scaling-stroke");
  if (isMobile) {
    await page.getByRole("button", { name: /^อุดมทรัพย์/ }).click();
  } else {
    await centerInViewport(localMap);
    await clickSvgPathFillPoint(
      page,
      localSvg.locator('[data-nr-subdistrict-code="302504"]'),
      false,
    );
    await expect(nakhonRatchasimaPreview).toContainText("อุดมทรัพย์");
    await expect(nakhonRatchasimaPreview.getByRole("button", { name: "เปิดตำบลนี้" })).toBeVisible();
    await expect(nakhonRatchasimaPreview.getByRole("button", { name: "เปิดอำเภอนี้" })).toHaveCount(0);
    await nakhonRatchasimaPreview.getByRole("button", { name: "เปิดตำบลนี้" }).click();
  }
  await expect(page).toHaveURL(/\/wang-nam-khiao\/t-302504$/);
  await expect(page.getByRole("heading", { name: "อุดมทรัพย์", exact: true })).toBeVisible();

  if (!isMobile) {
    await expect(page.locator(".nr-layer-control")).toHaveCount(0);
    await page.goto("/mueang-nakhon-ratchasima");
    await centerInViewport(localMap);
    await clickSvgPathFillPoint(
      page,
      localSvg.locator('[data-nr-subdistrict-code="300101"]'),
      false,
    );
    await expect(nakhonRatchasimaPreview).toContainText("ในเมือง");
    await expect(nakhonRatchasimaPreview.getByRole("button", { name: "เปิดอำเภอนี้" })).toHaveCount(0);
    await expect(nakhonRatchasimaPreview.getByRole("button", { name: "เปิดตำบลนี้" })).toBeVisible();
    await expectPreviewInsideMap(nakhonRatchasimaPreview, localMap);
    await nakhonRatchasimaPreview.getByRole("button", { name: "เปิดตำบลนี้" }).click();
    await expect(page).toHaveURL(/\/mueang-nakhon-ratchasima\/t-300101$/);
    await expect(page.getByRole("heading", { name: "ในเมือง", exact: true })).toBeVisible();
    await expect(page.getByText("พื้นที่นี้ยังไม่มีหลักฐานเชิงลึกระดับท้องถิ่นในรอบข้อมูลนี้").first()).toBeVisible();
  }
});

test("Nakhon Ratchasima local map zoom controls do not re-render per animation frame", async ({ page }, testInfo) => {
  test.setTimeout(45_000);
  if (testInfo.project.name === "mobile") test.skip(true, "React commit instrumentation is covered on desktop.");

  await installReactCommitCounter(page);
  await loginAs(page, smokeUsername);
  await page.goto("/");

  const localMap = page.locator(".nr-map-panel").first();
  const localSvg = page.getByRole("img", { name: "แผนที่ตำบลจังหวัดนครราชสีมา" });
  await expect(localSvg).toBeVisible();
  await expect(localSvg.locator(".nr-map-shape")).toHaveCount(289);
  const transformLayerPathCount = await localSvg.locator(".nr-map-transform-layer path").count();
  expect(transformLayerPathCount).toBeGreaterThanOrEqual(500);
  expect(transformLayerPathCount).toBeLessThan(700);
  await centerInViewport(localMap);

  const resetButton = localMap.getByTitle("กลับมุมมองพื้นที่นี้");
  const zoomInButton = localMap.getByTitle("ขยายแผนที่");
  const zoomOutButton = localMap.getByTitle("ย่อแผนที่");

  await resetButton.click();
  await page.waitForTimeout(260);
  const initial = await readMapTransform(localSvg, ".nr-map-transform-layer");

  await startNrMapTransformProbe(page);
  await zoomInButton.click();
  await page.waitForTimeout(260);
  const singleZoomProbe = await stopNrMapTransformProbe(page);
  const singleZoom = await readMapTransform(localSvg, ".nr-map-transform-layer");
  expect(singleZoom.k).toBeGreaterThan(initial.k + 0.4);
  expect(singleZoomProbe.distinctTransforms).toBeGreaterThan(1);
  expect(singleZoomProbe.mutationCount).toBeGreaterThan(1);
  expect(singleZoomProbe.reactCommits).toBeLessThanOrEqual(2);

  await resetButton.click();
  await page.waitForTimeout(260);
  const reset = await readMapTransform(localSvg, ".nr-map-transform-layer");
  await page.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>('button[title="ขยายแผนที่"]');
    button?.click();
    button?.click();
    button?.click();
  });
  await page.waitForTimeout(260);
  const rapidZoom = await readMapTransform(localSvg, ".nr-map-transform-layer");
  expect(rapidZoom.k).toBeCloseTo(Math.min(reset.k + 0.52 * 3, 7.2), 2);

  await resetButton.click();
  await page.waitForTimeout(260);
  const beforeInOut = await readMapTransform(localSvg, ".nr-map-transform-layer");
  await page.evaluate(() => {
    document.querySelector<HTMLButtonElement>('button[title="ขยายแผนที่"]')?.click();
    document.querySelector<HTMLButtonElement>('button[title="ย่อแผนที่"]')?.click();
  });
  await page.waitForTimeout(260);
  const afterInOut = await readMapTransform(localSvg, ".nr-map-transform-layer");
  expect(afterInOut.k).toBeCloseTo(beforeInOut.k, 2);
  expect(afterInOut.x).toBeCloseTo(beforeInOut.x, 1);
  expect(afterInOut.y).toBeCloseTo(beforeInOut.y, 1);

  await zoomOutButton.click();
  await page.waitForTimeout(260);
  const zoomedOut = await readMapTransform(localSvg, ".nr-map-transform-layer");
  expect(zoomedOut.k).toBeLessThan(beforeInOut.k);
});
