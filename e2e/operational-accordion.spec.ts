import { expect, test, fillAuthForm } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await fillAuthForm(page);
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page.locator('.sidebar-account .account-trigger')).toHaveCount(1);
});

for (const [scope, path] of [["province", "/drought"], ["district", "/thepharak"]]) {
  test(`${scope} actions open one card below its two collapsed siblings`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${path}?mapLayer=forecast-archive&target=2025-12&horizon=1`);
    const group = page.locator(".nr-operational-forecast-actions");
    await expect(group.locator(":scope > details")).toHaveCount(3);
    const map = page.locator(".nr-drought-workspace-map-card");
    const mapBefore = await map.boundingBox();
    const initialUrl = page.url();
    const summary = group.locator(".nr-operational-forecast-summary");
    const guidance = group.locator(".nr-operational-guidance");
    const attention = group.locator("details").filter({ has: page.locator(".nr-operational-attention-list") });

    for (const card of [attention, summary, guidance, attention]) {
      const trigger = card.locator("summary");
      await trigger.focus();
      await trigger.press("Enter");
      await expect(group.locator("details[open]")).toHaveCount(1);
      await expect(card).toHaveAttribute("open", "");
      await expect(trigger).toBeFocused();
      await expect(trigger).toHaveAttribute("aria-expanded", "true");
      const geometry = await group.evaluate(element => {
        const cards = [...element.children];
        const boxes = cards.map(card => card.getBoundingClientRect());
        return {
          openLast: cards.at(-1)?.hasAttribute("open"),
          closed: boxes.slice(0, -1).map(box => ({ x: box.x, y: box.y, right: box.right, bottom: box.bottom })),
          open: boxes.at(-1)!.toJSON(),
          width: element.getBoundingClientRect().width,
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      expect(geometry.openLast).toBe(true);
      expect(geometry.closed[0].y).toBeCloseTo(geometry.closed[1].y, 0);
      expect(geometry.closed[0].right).toBeLessThan(geometry.closed[1].x);
      expect(Math.max(...geometry.closed.map(box => box.bottom))).toBeLessThan(geometry.open.y);
      expect(geometry.open.width).toBeCloseTo(geometry.width, 0);
      expect(geometry.overflow).toBe(false);
      expect(page.url()).toBe(initialUrl);
    }
    await group.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`${scope}-attention-open.png`) });
    await attention.locator("summary").press("Space");
    await expect(group.locator("details[open]")).toHaveCount(0);
    await expect(group.locator(":scope > details").first()).toHaveClass(/nr-operational-forecast-summary/);
    await expect(attention.locator("summary")).toBeFocused();
    const mapAfter = await map.boundingBox();
    expect(mapAfter?.width).toBe(mapBefore?.width);
    expect(mapAfter?.height).toBe(mapBefore?.height);
    expect(errors).toEqual([]);
  });
}

test("unavailable and empty-irrigation scopes retain only applicable action cards", async ({ page }) => {
  await page.goto("/ban-lueam?mapLayer=forecast-archive&target=2025-12&horizon=1");
  const group = page.locator(".nr-operational-forecast-actions");
  await expect(group.locator(":scope > details")).toHaveCount(2);
  await expect(group.locator(".nr-operational-forecast-summary")).toContainText("ไม่มีค่าพยากรณ์ในรอบนี้");
  await group.locator(".nr-operational-forecast-summary > summary").click();
  await group.locator(".nr-operational-guidance > summary").click();
  await expect(group.locator("details[open]")).toHaveCount(1);

  await page.goto("/soeng-sang?mapLayer=forecast-archive&target=2025-12&horizon=1&irrigation=irrigated");
  await expect(group.locator(":scope > details")).toHaveCount(1);
  await expect(group.locator(".nr-operational-guidance")).toBeVisible();
  await group.locator("summary").click();
  await expect(group.locator("details[open]")).toHaveCount(1);
});
