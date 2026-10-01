import { test, expect, seedAdminSession } from './fixtures';
import { cmsTestDatabase } from '../tests/fixtures/admin-data.mjs';
import { writeFile } from 'node:fs/promises';

test('Admin cards preserve draft review and searchable resource access at each viewport', async ({ page, context }, info) => {
  test.setTimeout(120000);
  const database = await cmsTestDatabase(context, { references: true, forecasts: true });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await seedAdminSession(page);
    await page.goto('/admin');
    await expect(page.locator('.cms-resource-row')).toHaveCount(8);
    await page.getByRole('button', { name: 'ตรวจแก้รอบนี้', exact: true }).click();
    await expect(page).toHaveURL(/draft=/);
    const draftId = new URL(page.url()).searchParams.get('draft')!;
    await page.goto('/admin');
    await expect(page.locator('.cms-draft-list tbody tr')).toHaveCount(1);
    await expect(page.locator('.cms-forecast-metrics')).toContainText('เผยแพร่แล้ว');
    await page.evaluate(() => document.fonts.ready);
    await page.locator('.brand-mark img').evaluate((image: HTMLImageElement) => image.decode());
    await page.screenshot({ path: info.outputPath('admin-data-full.png'), fullPage: true });
    await page.screenshot({ path: info.outputPath('admin-data-viewport.png') });
    await writeFile(info.outputPath('geometry.json'), JSON.stringify(await page.evaluate(() => ({
      width: innerWidth, height: innerHeight, pageHeight: document.documentElement.scrollHeight,
      sections: ['.sidebar', '.cms-context-bar', '.cms-page-header', '.cms-published', '.cms-drafts-panel', '.cms-reference'].map(selector => {
        const element = document.querySelector(selector)!; const rect = element.getBoundingClientRect();
        return { selector, x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      }),
    })), null, 2));
    const controls = await Promise.all([
      page.getByRole('combobox', { name: 'เดือนตั้งต้นที่จะตรวจแก้', exact: true }),
      page.getByRole('button', { name: 'ตรวจแก้รอบนี้', exact: true }),
    ].map(locator => locator.boundingBox()));
    expect(Math.abs(controls[0]!.y - controls[1]!.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(controls[0]!.height - controls[1]!.height)).toBeLessThanOrEqual(2);
    if (info.project.name === 'mobile') {
      await expect(page.locator('.cms-resource-row:visible')).toHaveCount(3);
      await page.getByRole('button', { name: 'ดูข้อมูลทั้งหมด', exact: true }).click();
      await expect(page.locator('.cms-resource-row:visible')).toHaveCount(8);
      await page.getByRole('button', { name: 'แสดงน้อยลง', exact: true }).click();
      await expect(page.locator('.cms-resource-row:visible')).toHaveCount(3);
    }
    // An active search must reveal matching resources even when the mobile list is collapsed.
    await page.getByLabel('ค้นหาข้อมูลประกอบ', { exact: true }).fill('แหล่งข้อมูลอ้างอิง');
    await expect(page.locator('.cms-resource-row:visible')).toHaveCount(1);
    await page.getByRole('button', { name: 'เปิดข้อมูล', exact: true }).click();
    await expect(page).toHaveURL(/resource=/);
    await expect(page.getByRole('heading', { name: 'แหล่งข้อมูลอ้างอิง', exact: true })).toBeVisible();
    await page.locator('.cms-reference-context').getByRole('link', { name: 'จัดการข้อมูล', exact: true }).click();
    await page.getByLabel('ค้นหาข้อมูลประกอบ', { exact: true }).fill('ไม่ตรงกับข้อมูลใด');
    await expect(page.getByText('ไม่พบข้อมูลตามคำค้น', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'ล้างตัวกรอง', exact: true }).click();
    await expect(page.locator('.cms-resource-row')).toHaveCount(8);
    await page.locator('.cms-draft-open button').click();
    await expect(page).toHaveURL(new RegExp(`draft=${draftId}`));
    await page.reload();
    await expect(page.locator('.cms-editor')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  } finally { await database.close(); }
});
