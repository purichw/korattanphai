import { test, expect, seedAuthSession, fillAuthForm, authStorageKey, adminAuthStorageKey, openAccountMenu } from './fixtures';
import { cmsTestDatabase } from '../tests/fixtures/admin-data.mjs';

test('Admin login is separate and signout synchronizes only tabs in the same scope', async ({ page, context }, testInfo) => {
  test.setTimeout(120000);
  const database = await cmsTestDatabase(context, { references: process.env.PLAYWRIGHT_REFERENCE_BACKEND === 'cms' });
  try {
    await seedAuthSession(page);
    const cmsReads: string[] = [];
    page.on('request', request => { if (request.url().includes('/api/admin-data')) cmsReads.push(request.url()); });
    await page.goto('/admin?view=imports#workspace-content');
    await expect(page.getByRole('heading', { name: 'เข้าสู่ระบบผู้ดูแล', exact: true })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/admin/login');
    expect(new URL(page.url()).searchParams.get('next')).toBe('/admin?view=imports#workspace-content');
    expect(cmsReads).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('admin-login.png') });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await fillAuthForm(page);
    await page.getByLabel('รหัสผ่าน', { exact: true }).press('Enter');
    await expect(page.getByRole('heading', { name: 'ชุดข้อมูล', exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/admin\?view=imports#workspace-content$/);
    expect(await page.evaluate(keys => keys.map(key => Boolean(localStorage.getItem(key))), [authStorageKey, adminAuthStorageKey])).toEqual([true, true]);
    const visitor = await context.newPage();
    await visitor.goto('/');
    await expect(visitor.locator('.sidebar-account .account-trigger')).toHaveCount(1);
    const [adminSidebar, visitorSidebar] = await Promise.all([page, visitor].map(async currentPage => {
      await expect(currentPage.locator('.primary-nav').getByRole('button', { name: 'จัดการข้อมูล', exact: true, includeHidden: true })).toHaveCount(0);
      await currentPage.locator('.brand-mark img').evaluate((image: HTMLImageElement) => image.decode());
      return currentPage.locator('.sidebar').evaluate(sidebar => {
        const logo = sidebar.querySelector('.brand-mark')!;
        const image = logo.querySelector('img')!;
        return { width: sidebar.getBoundingClientRect().width, logoWidth: logo.getBoundingClientRect().width,
          logoHeight: logo.getBoundingClientRect().height, imageSrc: image.currentSrc };
      });
    }));
    expect(adminSidebar.width).toBeCloseTo(visitorSidebar.width, 1);
    expect(adminSidebar.logoWidth).toBeCloseTo(visitorSidebar.logoWidth, 1);
    expect(adminSidebar.logoHeight).toBeCloseTo(visitorSidebar.logoHeight, 1);
    expect(adminSidebar.imageSrc).toBe(visitorSidebar.imageSrc);
    const otherAdmin = await context.newPage();
    await otherAdmin.goto('/admin');
    await expect(otherAdmin.getByRole('heading', { name: 'ชุดข้อมูล', exact: true })).toBeVisible();
    await openAccountMenu(page);
    await page.getByRole('menuitem', { name: 'ออกจากระบบ', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/login$/);
    await expect(otherAdmin).toHaveURL(/\/admin\/login$/);
    await visitor.reload();
    await expect(visitor.locator('.sidebar-account .account-trigger')).toHaveCount(1);
    expect(await visitor.evaluate(key => Boolean(localStorage.getItem(key)), authStorageKey)).toBe(true);
    await fillAuthForm(page);
    await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'ชุดข้อมูล', exact: true })).toBeVisible();
    await openAccountMenu(visitor);
    await visitor.getByRole('menuitem', { name: 'ออกจากระบบ', exact: true }).click();
    await expect(visitor).toHaveURL(/\/login$/);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'ชุดข้อมูล', exact: true })).toBeVisible();
    expect(await page.evaluate(keys => keys.map(key => Boolean(localStorage.getItem(key))), [authStorageKey, adminAuthStorageKey])).toEqual([false, true]);
    const adminMenu = page.getByRole('button', { name: 'เปิดเมนูหลัก', exact: true });
    if (await adminMenu.isVisible()) await adminMenu.click();
    await page.locator('.primary-nav').getByRole('button', { name: 'ภาพรวม', exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await fillAuthForm(page); await page.getByLabel('รหัสผ่าน', { exact: true }).press('Enter');
    await expect(page.locator('.sidebar-account .account-trigger')).toHaveCount(1);
    await expect(page.locator('.primary-nav').getByRole('button', { name: 'จัดการข้อมูล', exact: true, includeHidden: true })).toHaveCount(0);
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'ชุดข้อมูล', exact: true })).toBeVisible();
    await page.goto('/admin/datasets');
    await expect(page.getByRole('heading', { name: 'ชุดข้อมูล', exact: true })).toBeVisible();
  } finally { await database.close(); }
});

test('admin login rejects unsafe return paths and shares password/error interaction', async ({ page, context }) => {
  test.setTimeout(60000);
  const database = await cmsTestDatabase(context, { references: process.env.PLAYWRIGHT_REFERENCE_BACKEND === 'cms' });
  try {
    await page.goto('/admin/login?next=https%3A%2F%2Fevil.test%2F');
    await fillAuthForm(page, 'wrong password');
    await page.getByRole('button', { name: 'แสดงรหัสผ่าน', exact: true }).click();
    await expect(page.getByLabel('รหัสผ่าน', { exact: true })).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: 'ซ่อนรหัสผ่าน', exact: true }).click();
    await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    expect(new URL(page.url()).pathname).toBe('/admin/login');
    await fillAuthForm(page); await page.getByLabel('รหัสผ่าน', { exact: true }).press('Enter');
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('heading', { name: 'ชุดข้อมูล', exact: true })).toBeVisible();
    expect(await page.evaluate(key => localStorage.getItem(key), authStorageKey)).toBeNull();
  } finally { await database.close(); }
});
