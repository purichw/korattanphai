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

async function readMapTransform(svg: Locator, transformSelector = ".map-transform-layer") {
  return svg.locator(transformSelector).evaluate((element) => {
    const values = (element.getAttribute("transform") ?? "")
      .match(/-?\d+(?:\.\d+)?/g)
      ?.map(Number);
    if (!values || values.length < 6) throw new Error("Map transform matrix was not readable");
    return { k: values[0], x: values[4], y: values[5] };
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
  await expect(page.getByRole("button", { name: /บัญชีผู้ใช้ Pointy/ })).toBeVisible();

  await page.getByRole("button", { name: /บัญชีผู้ใช้/ }).click();
  await page.getByRole("menuitem", { name: /ออกจากระบบ/ }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("ชื่อผู้ใช้").fill("SOMSAK");
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page.getByRole("button", { name: /บัญชีผู้ใช้ Somsak/ })).toBeVisible();
});

test("Nakhon Ratchasima-only shell opens the provincial overview with nested drought nav", async ({ page }) => {
  await loginAs(page, smokeUsername);

  await expect(page).toHaveURL(/\/$/);
  await expect(page).toHaveTitle(/Korat Tan Phai/);
  await expect(page.getByRole("heading", { name: "จังหวัดนครราชสีมา" })).toBeVisible();
  const accountTrigger = page.getByRole("button", { name: /บัญชีผู้ใช้/ });
  await expect(accountTrigger).toBeVisible();
  await expect(page.locator(".topbar .login-session-chip")).toHaveCount(0);
  await expect(page.locator(".topbar .persona-select")).toHaveCount(0);
  await expect(page.locator(".topbar .secondary-button")).toHaveCount(0);
  await accountTrigger.click();
  const accountMenu = page.getByRole("menu", { name: "บัญชีผู้ใช้" });
  await expect(accountMenu).toContainText("Pointy");
  await expect(accountMenu).toContainText("เจ้าหน้าที่เกษตรจังหวัด");
  await expect(accountMenu.getByRole("menuitemradio", { name: /เจ้าหน้าที่เกษตรอำเภอ/ })).toBeVisible();
  await expect(accountMenu.getByRole("menuitem", { name: /รีเซ็ตข้อมูลเดโม/ })).toBeVisible();
  await expect(accountMenu.getByRole("menuitem", { name: /ออกจากระบบ/ })).toBeVisible();
  await accountMenu.getByRole("menuitemradio", { name: /เจ้าหน้าที่เกษตรอำเภอ/ }).click();
  await expect(page.getByRole("button", { name: /บัญชีผู้ใช้ Pointy เจ้าหน้าที่เกษตรอำเภอ/ })).toBeVisible();
  await page.getByRole("button", { name: /บัญชีผู้ใช้/ }).click();
  await page.getByRole("menuitemradio", { name: /เจ้าหน้าที่เกษตรจังหวัด/ }).click();
  await expect(page.getByRole("heading", { name: "แผนที่สถานการณ์ภัยแล้ง" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "บริบทความเสี่ยงภัยแล้ง" })).toHaveCount(0);
  await expect(page.getByText("ความเชื่อมั่นของข้อมูล").first()).toBeVisible();
  const overviewMapBox = await boundingBoxOrThrow(page.locator(".nr-dashboard-map-card.is-overview-map"));
  const overviewWorkspaceBox = await boundingBoxOrThrow(page.locator(".nr-workspace"));
  expect(overviewMapBox.width).toBeGreaterThan(overviewWorkspaceBox.width * 0.88);
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
  await expect(page.getByRole("heading", { name: "พยากรณ์พื้นที่เสี่ยงภัยแล้ง 6 เดือน" })).toBeVisible();
  await closePrimaryNav(page);
  await expect(page.locator(".nr-drought-dashboard")).toBeVisible();
  await expect(page.locator(".nr-drought-forecast-row .nr-drought-forecast-section")).toBeVisible();
  await expect(page.locator(".nr-drought-forecast-section .nr-forecast-summary-panel")).toBeVisible();
  await expect(page.locator(".nr-drought-forecast-section").getByText("ระดับเสี่ยงสูงสุด")).toBeVisible();
  await expect(page.locator(".nr-drought-forecast-section .nr-forecast-summary-stack")).toHaveCount(0);
  await expect(page.locator(".nr-drought-forecast-section .metric-card")).toHaveCount(0);
  await expect(page.locator(".nr-drought-forecast-section .nr-forecast-timeline li")).toHaveCount(6);
  await expect(page.locator(".nr-drought-forecast-section .nr-forecast-timeline").getByText("167 ตำบล")).toHaveCount(3);
  await expect(page.locator(".nr-drought-forecast-section").getByText("เดือนที่เสี่ยงสูงสุด")).toHaveCount(0);
  await expect(page.locator(".nr-drought-forecast-row .nr-research-attention")).toBeVisible();
  await expect(page.locator(".nr-dashboard-module-grid .nr-follow-up-section")).toHaveCount(0);
  const viewport = page.viewportSize();
  const forecastBox = await boundingBoxOrThrow(page.locator(".nr-drought-forecast-section"));
  const attentionBox = await boundingBoxOrThrow(page.locator(".nr-research-attention"));
  const situationBox = await boundingBoxOrThrow(page.locator(".nr-drought-situation-section"));
  const mapBox = await boundingBoxOrThrow(page.locator(".nr-dashboard-map-card"));
  const mapToolbar = page.locator(".nr-dashboard-map-card .nr-local-map-criteria");
  const mapControls = page.locator(".nr-dashboard-map-card .nr-map-controls");
  await expect(page.getByRole("heading", { name: "แผนที่ภัยแล้งจากชุดข้อมูล" })).toBeVisible();
  await expect(mapToolbar.getByRole("combobox")).toHaveCount(4);
  await expect(mapToolbar.getByRole("combobox", { name: "เดือนข้อมูลบนแผนที่จังหวัดนครราชสีมา" })).toBeVisible();
  await expect(mapToolbar.getByRole("combobox", { name: "มุมมองแผนที่" })).toBeVisible();
  await expect(mapToolbar.getByRole("combobox", { name: "สถานะข้อมูล" })).toBeVisible();
  await expect(mapToolbar.getByRole("combobox", { name: "ระดับภัยแล้ง" })).toBeVisible();
  await expect(mapToolbar.locator(".nr-local-map-filter-status")).toHaveCount(0);
  await expect(mapToolbar).not.toContainText(/\/.*ตำบล/);
  await mapToolbar.getByRole("combobox", { name: "ระดับภัยแล้ง" }).click();
  await page.getByRole("option", { name: "เสี่ยงสูง" }).click();
  await expect(mapToolbar.locator(".nr-local-map-filter-status")).toContainText(/แสดง .* จาก .* ตำบล|ไม่พบตำบลที่ตรงกับตัวกรอง/);
  await mapToolbar.getByRole("button", { name: "รีเซ็ต" }).click();
  await expect(mapToolbar.locator(".nr-local-map-filter-status")).toHaveCount(0);
  const dashboardBox = await boundingBoxOrThrow(page.locator(".nr-drought-dashboard"));
  if ((viewport?.width ?? 0) >= 1180) {
    expect(Math.abs(forecastBox.y - attentionBox.y)).toBeLessThan(8);
    expect(attentionBox.x).toBeGreaterThan(forecastBox.x + forecastBox.width - 2);
    const toolbarBox = await boundingBoxOrThrow(mapToolbar);
    const controlsBox = await boundingBoxOrThrow(mapControls);
    expect(toolbarBox.x + toolbarBox.width).toBeLessThanOrEqual(controlsBox.x - 4);
    expect(controlsBox.height).toBeGreaterThan(controlsBox.width * 2);
  } else {
    expect(attentionBox.y).toBeGreaterThan(forecastBox.y);
  }
  expect(situationBox.y).toBeGreaterThan(forecastBox.y);
  expect(mapBox.y).toBeGreaterThan(situationBox.y);
  expect(mapBox.width).toBeGreaterThan(dashboardBox.width * 0.94);
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
  await expect(page.locator(".nr-dashboard-tabs").getByRole("tab")).toHaveCount(2);
  await expect(page.locator(".nr-dashboard-tabs").getByRole("tab", { name: /ภาพรวม/ })).toBeVisible();
  await expect(page.locator(".nr-dashboard-tabs").getByRole("tab", { name: /ภัยแล้ง/ })).toBeVisible();
  await expect(page.locator(".nr-dashboard-tabs").getByRole("tab", { name: /^น้ำ/ })).toHaveCount(0);
  await expect(page.locator(".brand-mark img")).toHaveAttribute("src", "/brand/korat-tan-phai-sidebar-logo.webp");
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("sizes", "512x512");
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
    "href",
    "/brand/korat-tan-phai-favicon.png?v=3",
  );
  await expect(page.getByRole("heading", { name: "จังหวัดนครราชสีมา" })).toBeVisible();
});

test("removed water route no longer renders the province water page", async ({ page }) => {
  await loginAs(page, smokeUsername);
  await page.goto("/water");

  await expect(page.getByRole("heading", { name: "ไม่พบพื้นที่" })).toBeVisible();
  await expect(page.getByRole("button", { name: "กลับภาพรวม" })).toBeVisible();
  await expect(page.getByText("แผนที่ฝนย้อนหลังในชุดข้อมูล")).toHaveCount(0);
  await expect(page.getByText("พยากรณ์ฝน")).toHaveCount(0);
  await expect(page.locator(".nr-dashboard-tabs").getByRole("tab", { name: /^น้ำ/ })).toHaveCount(0);
});

test("custom dropdowns are app-rendered and keyboard operable", async ({ page }) => {
  await loginAs(page, smokeUsername);

  await expect(page.locator("select")).toHaveCount(0);

  const filters = page.locator(".control-band");
  const hazard = filters.getByRole("combobox", { name: /^ภัย/ });
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

  const crop = filters.getByRole("combobox", { name: /^พืช/ });
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
  await expect(page.getByRole("heading", { name: "จังหวัดนครราชสีมา" })).toBeVisible();
});

test("Nakhon Ratchasima province drill-down preserves code-based evidence and no-data wording", async ({ page }) => {
  test.setTimeout(60_000);

  await loginAs(page, smokeUsername);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "พืชที่ได้รับผลกระทบ" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "จังหวัดนครราชสีมา" })).toBeVisible();
  await expect(page.locator(".data-provenance-chip.is-real").first()).toBeVisible();
  await expect(page.locator(".data-provenance-chip.is-synthetic").first()).toBeVisible();
  await expect(page.locator(".data-provenance-chip.is-derived").first()).toBeVisible();
  await expect(page.locator(".data-provenance-chip.is-proxy").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "กลับแผนที่ประเทศ" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "ย้อนกลับหนึ่งระดับ" })).toHaveCount(0);
  const localMap = page.locator(".nr-map-panel").first();
  const localSvg = page.getByRole("img", { name: "แผนที่ตำบลจังหวัดนครราชสีมา" });
  await expect(localSvg).toBeVisible();
  await centerInViewport(localMap);
  await expect(localSvg.locator(".nr-map-context-layer path")).toHaveCount(289);
  await expect(localSvg.locator(".nr-map-shape")).toHaveCount(289);
  await expect(localMap.locator(".map-overlay-controls").getByTitle("ขยายแผนที่")).toBeVisible();
  const guardrail = page.locator(".nr-guardrail details");
  await expect(guardrail.getByText("ข้อกำกับข้อมูลสำคัญ")).toBeVisible();
  await guardrail.locator("summary").click();
  await expect(guardrail).toContainText("การเชื่อมข้อมูลใช้รหัสจังหวัด/อำเภอ/ตำบลเท่านั้น");

  const nakhonRatchasimaFilters = page.locator(".nr-workspace > .control-band").first();
  await expect(nakhonRatchasimaFilters.getByRole("combobox", { name: /^เดือน/ })).toBeVisible();
  await expect(nakhonRatchasimaFilters.getByRole("combobox", { name: /^ภัย/ })).toBeVisible();
  await expect(nakhonRatchasimaFilters.getByRole("combobox", { name: /^พืช/ })).toBeVisible();
  await expect(nakhonRatchasimaFilters.getByRole("combobox", { name: /^ตำบล/ })).toHaveCount(0);
  const provinceDistrictSelect = nakhonRatchasimaFilters.getByRole("combobox", { name: /^อำเภอ/ });
  await expect(provinceDistrictSelect).toBeVisible();
  await provinceDistrictSelect.click();
  const provinceDistrictListboxId = await provinceDistrictSelect.getAttribute("aria-controls");
  expect(provinceDistrictListboxId).toBeTruthy();
  const provinceDistrictMenu = page.locator(`#${provinceDistrictListboxId}`);
  await expect(provinceDistrictMenu).toContainText("วังน้ำเขียว");
  await expect(provinceDistrictMenu).toContainText("มีข้อมูล");
  await provinceDistrictMenu.locator('[data-select-value="3025"]').click();
  await expect(page).toHaveURL(/\/wang-nam-khiao$/);
  await expect(page.getByRole("heading", { name: "วังน้ำเขียว", exact: true })).toBeVisible();
  const districtAreaFiltersFromProvince = page.locator(".nr-workspace > .control-band").first();
  const districtSubdistrictSelect = districtAreaFiltersFromProvince.getByRole("combobox", { name: /^ตำบล/ });
  await expect(districtSubdistrictSelect).toBeVisible();
  await districtSubdistrictSelect.click();
  const districtSubdistrictListboxId = await districtSubdistrictSelect.getAttribute("aria-controls");
  expect(districtSubdistrictListboxId).toBeTruthy();
  const districtSubdistrictMenu = page.locator(`#${districtSubdistrictListboxId}`);
  await expect(districtSubdistrictMenu).not.toContainText("สถานีในพื้นที่");
  await expect(districtSubdistrictMenu).not.toContainText("ใช้สถานีใกล้สุด");
  await districtSubdistrictMenu.locator('[data-select-value="302504"]').click();
  await expect(page).toHaveURL(/\/wang-nam-khiao\/t-302504$/);
  await expect(page.getByRole("heading", { name: "อุดมทรัพย์", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "กลับอำเภอ" })).toBeVisible();
  await expect(page.getByRole("button", { name: "ย้อนกลับหนึ่งระดับ" })).toHaveCount(0);
  const subdistrictFilters = page.locator(".nr-workspace > .control-band").first();
  await expect(subdistrictFilters.getByRole("combobox")).toHaveCount(3);
  await expect(subdistrictFilters.getByRole("combobox", { name: /^ตำบล/ })).toHaveCount(0);
  await page.getByRole("button", { name: "กลับอำเภอ" }).click();
  await expect(page).toHaveURL(/\/wang-nam-khiao$/);
  await expect(page.getByRole("button", { name: "กลับจังหวัด" })).toBeVisible();
  await expect(page.getByRole("button", { name: "ย้อนกลับหนึ่งระดับ" })).toHaveCount(0);
  const districtFilters = page.locator(".nr-workspace > .control-band").first();
  await expect(districtFilters.getByRole("combobox", { name: /^ตำบล/ })).toBeVisible();
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
  await expect(page.getByText("ข้อมูลที่ยังไม่มี").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "แผนที่ตำบลที่เลือก" })).toBeVisible();
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
  await expect(page.getByText("พื้นที่นี้ยังไม่มีหลักฐานเชิงลึกระดับท้องถิ่นในชุดข้อมูลนี้").first()).toBeVisible();
  await expect(page.getByText("ข้อมูลว่างไม่เท่ากับความเสี่ยงต่ำ").first()).toBeVisible();
  await expect(page.getByText("ยังไม่มีรายการพยากรณ์ภัยแล้งของพื้นที่นี้ในชุดข้อมูลพยากรณ์")).toBeVisible();
  await expect(page.getByText("หลักฐานสถานี")).toHaveCount(0);
  await expect(page.getByText("ไม่มีข้อมูล").first()).toBeVisible();

  await page.goto("/");
  await expect(page.getByRole("button", { name: "กลับแผนที่ประเทศ" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "ย้อนกลับหนึ่งระดับ" })).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "จังหวัดนครราชสีมา" })).toBeVisible();
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

  await clickSvgPathFillPoint(
    page,
    localSvg.locator('[data-nr-subdistrict-code="302505"]'),
    isMobile,
  );
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
  }
  await nakhonRatchasimaPreview.getByRole("button", { name: "เปิดอำเภอนี้" }).click();

  await expect(page).toHaveURL(/\/wang-nam-khiao$/);
  await expect(page.getByRole("heading", { name: "วังน้ำเขียว", exact: true })).toBeVisible();
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
    await expect(page.getByText("พื้นที่นี้ยังไม่มีหลักฐานเชิงลึกระดับท้องถิ่นในชุดข้อมูลนี้").first()).toBeVisible();
  }
});
