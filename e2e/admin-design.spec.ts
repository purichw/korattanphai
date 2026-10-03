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
    await expect(page.locator('.cms-resource-group')).toHaveCount(3);
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
    const monthOffset = await page.locator('.cms-month-control .app-select-trigger').evaluate(button => {
      const box = button.getBoundingClientRect(), value = button.querySelector('.app-select-value')!.getBoundingClientRect();
      return [value.x + value.width / 2 - box.x - box.width / 2, value.y + value.height / 2 - box.y - box.height / 2];
    });
    for (const offset of monthOffset) expect(Math.abs(offset)).toBeLessThanOrEqual(0.5);
    await expect(page.locator('.cms-resource-group:visible')).toHaveCount(3);
    await expect(page.getByRole('button', { name: 'ดูข้อมูลทั้งหมด', exact: true })).toHaveCount(0);
    const maps = page.locator('.cms-resource-group[data-group="maps"]');
    await expect(maps.getByRole('button', { name: 'ดูชั้นข้อมูล', exact: true })).toHaveAttribute('aria-expanded', 'false');
    await expect(maps.locator('.cms-map-resource:visible')).toHaveCount(0);
    const captureReferences = async (name: string) => {
      const clip = await page.locator('.cms-reference').evaluate(element => {
        const box = element.getBoundingClientRect();
        const x = Math.max(0, box.x - 16), y = Math.max(0, box.y + scrollY - 16);
        return { x, y, width: Math.min(document.documentElement.scrollWidth - x, box.width + 32),
          height: Math.min(document.documentElement.scrollHeight - y, box.height + 32) };
      });
      await page.screenshot({ path: info.outputPath(name), fullPage: true, clip });
    };
    await captureReferences('admin-reference-groups.png');
    await maps.getByRole('button', { name: 'ดูชั้นข้อมูล', exact: true }).click();
    await expect(maps.getByRole('button', { name: 'ย่อชั้นข้อมูล', exact: true })).toHaveAttribute('aria-expanded', 'true');
    await expect(maps.locator('.cms-map-resource:visible')).toHaveCount(2);
    await captureReferences('admin-reference-maps-expanded.png');
    await maps.getByRole('button', { name: 'ย่อชั้นข้อมูล', exact: true }).click();
    await expect(maps.locator('.cms-map-resource:visible')).toHaveCount(0);

    // Each group remains reachable on mobile; filtering and child search disclose the map resources.
    const category = page.getByRole('combobox', { name: 'หมวดข้อมูล', exact: true });
    for (const [name, key] of [['ข้อมูลพื้นที่', 'areas'], ['ชั้นข้อมูลแผนที่', 'maps'], ['แหล่งข้อมูลอ้างอิง', 'sources']]) {
      await category.click();
      await page.getByRole('option', { name, exact: true }).click();
      await expect(page.locator('.cms-resource-group:visible')).toHaveCount(1);
      await expect(page.locator(`.cms-resource-group[data-group="${key}"]`)).toBeVisible();
    }
    await category.click();
    await page.getByRole('option', { name: 'ทุกหมวด', exact: true }).click();
    await expect(page.locator('.cms-resource-group:visible')).toHaveCount(3);
    await page.getByLabel('ค้นหาข้อมูลประกอบ', { exact: true }).fill('เส้นรอบจังหวัดนครราชสีมา');
    await expect(page.locator('.cms-resource-group:visible')).toHaveCount(1);
    await expect(maps.locator('.cms-map-resource:visible')).toHaveCount(1);
    await expect(maps.getByRole('button', { name: 'ย่อชั้นข้อมูล', exact: true })).toHaveAttribute('aria-expanded', 'true');
    await maps.getByRole('button', { name: 'เปิดข้อมูล', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'เส้นรอบจังหวัดนครราชสีมา', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'จังหวัดนครราชสีมา', exact: true })).toBeVisible();
    await page.locator('.cms-reference-context').getByRole('link', { name: 'จัดการข้อมูล', exact: true }).click();

    for (const hidden of ['รายชื่อและพิกัดสถานีฝน', 'สถานีฝนที่อยู่ใกล้แต่ละตำบล', 'ขอบเขตประเทศรอบข้าง']) {
      await page.getByLabel('ค้นหาข้อมูลประกอบ', { exact: true }).fill(hidden);
      await expect(page.locator('.cms-resource-group')).toHaveCount(0);
      await expect(page.getByText('ไม่พบข้อมูลตามคำค้น', { exact: true })).toBeVisible();
    }
    await page.getByLabel('ค้นหาข้อมูลประกอบ', { exact: true }).fill('แหล่งข้อมูลอ้างอิง');
    await expect(page.locator('.cms-resource-group:visible')).toHaveCount(1);
    await page.getByRole('button', { name: 'เปิดข้อมูล', exact: true }).click();
    await expect(page).toHaveURL(/resource=/);
    await expect(page.getByRole('heading', { name: 'แหล่งข้อมูลอ้างอิง', exact: true })).toBeVisible();
    await page.locator('.cms-reference-context').getByRole('link', { name: 'จัดการข้อมูล', exact: true }).click();
    await page.getByLabel('ค้นหาข้อมูลประกอบ', { exact: true }).fill('ไม่ตรงกับข้อมูลใด');
    await expect(page.getByText('ไม่พบข้อมูลตามคำค้น', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'ล้างตัวกรอง', exact: true }).click();
    await expect(page.locator('.cms-resource-group:visible')).toHaveCount(3);
    await page.locator('.cms-draft-open button').click();
    await expect(page).toHaveURL(new RegExp(`draft=${draftId}`));
    await page.reload();
    await expect(page.locator('.cms-editor')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  } finally { await database.close(); }
});
