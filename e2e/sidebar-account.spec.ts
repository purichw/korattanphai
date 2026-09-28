import { expect, test, seedAuthSession, authTestEmail } from './fixtures';

test('sidebar account stays anchored and preserves keyboard, dismissal and route behavior', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await seedAuthSession(page);
  await page.goto('/');
  await expect(page.locator('.nr-forecast-overview-heading h1')).toContainText('นครราชสีมา');
  const trigger = page.locator('.sidebar-account .account-trigger');
  await expect(trigger).toHaveCount(1);
  await expect(page.locator('.topbar .account-trigger, .mobile-account-slot .account-trigger')).toHaveCount(0);
  const mobile = (page.viewportSize()?.width ?? 1440) <= 1180;
  if (mobile) {
    await expect(trigger).toBeHidden();
    await page.getByRole('button', { name: 'เปิดเมนูหลัก', exact: true }).click();
  }
  await expect(trigger).toBeVisible();
  const triggerBox = await trigger.boundingBox();
  expect(triggerBox).not.toBeNull();
  if (!mobile) expect(triggerBox!.y + triggerBox!.height).toBeGreaterThan(page.viewportSize()!.height - 32);
  const navBox = await page.locator('#primary-navigation').boundingBox();
  expect(triggerBox!.y).toBeGreaterThan(navBox!.y + navBox!.height);

  await trigger.focus();
  await page.keyboard.press('ArrowUp');
  const menu = page.getByRole('menu', { name: 'บัญชีผู้ใช้', exact: true });
  await expect(menu).toBeVisible();
  await expect(menu).toContainText(authTestEmail);
  await expect(menu.getByRole('menuitem', { name: 'ออกจากระบบ', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(menu.getByRole('menuitem')).toBeFocused();
  await menu.locator('.account-menu-profile').click();
  await expect(menu).toBeVisible();
  const menuBox = await menu.boundingBox();
  expect(menuBox!.x).toBeGreaterThanOrEqual(0);
  expect(menuBox!.y).toBeGreaterThanOrEqual(0);
  expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  if (!mobile) expect(menuBox!.y + menuBox!.height).toBeLessThan(triggerBox!.y);

  await page.evaluate(() => document.fonts.ready);
  await page.locator('.brand-mark img').evaluate(async (image: HTMLImageElement) => {
    await image.decode();
    if (!image.naturalWidth) throw new Error('Sidebar logo is not decoded');
  });
  await expect(page.locator('.nr-forecast-overview-summary')).toContainText('117/289');
  await expect(page.locator('.nr-map-svg').first()).toBeVisible();
  await page.screenshot({ path: info.outputPath('sidebar-account-open.png') });
  const scrollY = await page.evaluate(() => window.scrollY);
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
  if (mobile) {
    await expect(trigger.locator('.account-trigger-chevron')).toHaveCSS('transform', 'none');
    await page.screenshot({ path: info.outputPath('sidebar-account-mobile-navigation.png') });
  }

  await trigger.click();
  if (mobile) await page.locator('.account-menu-backdrop').click({ position: { x: 4, y: 4 } });
  else await page.locator('.nr-forecast-overview-heading h1').click();
  await expect(menu).toHaveCount(0);
  await page.locator('#primary-navigation').getByRole('button', { name: 'ภัยแล้ง', exact: true }).click();
  await expect(page).toHaveURL(/\/drought/);
  await expect(trigger).toHaveCount(1);
  if (mobile) await expect(trigger).toBeHidden();
  else {
    await page.evaluate(() => window.scrollTo(0, 600));
    await expect.poll(async () => Math.round((await trigger.boundingBox())!.y)).toBe(Math.round(triggerBox!.y));
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('short screens keep both the last navigation item and account reachable', async ({ page }) => {
  const mobile = (page.viewportSize()?.width ?? 1440) <= 1180;
  await page.setViewportSize({ width: mobile ? 390 : 1440, height: 480 });
  await seedAuthSession(page);
  await page.goto('/');
  const trigger = page.locator('.sidebar-account .account-trigger');
  await expect(trigger).toHaveCount(1);
  if (mobile) await page.getByRole('button', { name: 'เปิดเมนูหลัก', exact: true }).click();
  const lastNavItem = page.locator('#primary-navigation button').last();
  await lastNavItem.scrollIntoViewIfNeeded();
  const lastBox = await lastNavItem.boundingBox();
  const accountBox = await trigger.boundingBox();
  expect(lastBox!.y).toBeGreaterThanOrEqual(0);
  expect(lastBox!.y + lastBox!.height).toBeLessThan(accountBox!.y);
  expect(accountBox!.y + accountBox!.height).toBeLessThanOrEqual(480);
  await trigger.click();
  const menu = page.getByRole('menu', { name: 'บัญชีผู้ใช้', exact: true });
  await expect(menu).toBeVisible();
  const menuBox = await menu.boundingBox();
  expect(menuBox!.y).toBeGreaterThanOrEqual(0);
  expect(menuBox!.y + menuBox!.height).toBeLessThanOrEqual(480);
  await expect(menu.getByRole('menuitem', { name: 'ออกจากระบบ', exact: true })).toBeInViewport();
});
