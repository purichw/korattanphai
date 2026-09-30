import { test, expect, seedAdminSession } from './fixtures';
import { cmsTestDatabase } from '../tests/fixtures/admin-data.mjs';

test('Admin navigation stays in CMS across views, history, upload and explicit discard', async ({ page, context }, info) => {
  test.setTimeout(90000);
  const database = await cmsTestDatabase(context, { forecasts: true, references: process.env.PLAYWRIGHT_REFERENCE_BACKEND === 'cms' });
  const errors: string[] = [];
  const visitorReads: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (/ktp_(?:saved|followed)|ktp_latest_forecast_revision|ktp_load_forecast_slice/.test(request.url())) visitorReads.push(request.url());
  });
  const openNavigation = async () => {
    const toggle = page.getByRole('button', { name: 'เปิดเมนูหลัก', exact: true });
    if (await toggle.isVisible()) await toggle.click();
  };
  const nav = page.getByRole('navigation', { name: 'เมนูผู้ดูแล', includeHidden: true });
  try {
    await seedAdminSession(page);
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'จัดการข้อมูล', exact: true })).toBeVisible();
    await openNavigation();
    await expect(nav.getByRole('link')).toHaveCount(3);
    for (const link of await nav.getByRole('link').all()) expect(await link.getAttribute('href')).toMatch(/^\/admin(?:\?|$)/);
    await expect(nav.getByRole('link', { name: 'จัดการข้อมูล', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('.topbar, .mobile-account-slot')).toHaveCount(0);
    await expect(nav.getByText('ภาพรวม', { exact: true })).toHaveCount(0);
    await expect(nav.getByText('ภัยแล้ง', { exact: true })).toHaveCount(0);
    await expect(nav.getByText('ส่งออก Excel', { exact: true })).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
    await page.locator('.brand-mark img').evaluate((image: HTMLImageElement) => image.decode());
    await page.screenshot({ path: info.outputPath('admin-navigation.png') });

    await nav.getByRole('link', { name: 'รายการนำเข้าและฉบับร่าง', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\?view=imports$/);
    await expect(page.getByRole('heading', { name: 'รายการนำเข้าและฉบับร่าง', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'พยากรณ์ที่แสดงบนเว็บไซต์' })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'รายการนำเข้าและฉบับร่าง', exact: true })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'จัดการข้อมูล', exact: true })).toBeVisible();
    await page.goForward();
    await expect(page.getByRole('heading', { name: 'รายการนำเข้าและฉบับร่าง', exact: true })).toBeVisible();
    await openNavigation();
    await nav.getByRole('link', { name: 'นำเข้าข้อมูล', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'นำเข้าชุดข้อมูล', exact: true });
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\/admin\?view=upload$/);
    await page.reload();
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('ไฟล์ข้อมูล', { exact: true }).setInputFiles({
      name: 'station.csv', mimeType: 'text/csv', buffer: Buffer.from('stationId,value\n001,12'),
    });
    await expect(dialog.getByRole('combobox', { name: /^ชีต/ })).toContainText('ข้อมูล CSV');
    await page.goBack();
    await expect(dialog.getByRole('alert')).toContainText('ยังมีข้อมูลที่ไม่ได้บันทึก');
    await expect(page).toHaveURL(/\/admin\?view=upload$/);
    await page.getByRole('button', { name: 'ปิดการนำเข้าข้อมูล', exact: true }).click();
    const discard = page.getByRole('dialog', { name: 'ยังไม่บันทึกฉบับร่าง', exact: true });
    await expect(discard).toBeVisible();
    await discard.getByRole('button', { name: 'ปิดโดยไม่บันทึก', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/\/admin\?view=imports$/);
    expect((await database.operation('list', {})).total).toBe(0);
    expect(visitorReads).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  } finally { await database.close(); }
});
