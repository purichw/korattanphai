import { test, expect, seedAdminSession } from './fixtures';
import { cmsTestDatabase } from '../tests/fixtures/admin-data.mjs';
import { writeFile } from 'node:fs/promises';

test('resource details filter, paginate, inspect and export selected original rows without writing data', async ({ page, context }, info) => {
  test.setTimeout(120000);
  const database = await cmsTestDatabase(context, { references: true });
  const errors: string[] = []; const writes: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    const action = new URL(request.url()).searchParams.get('action');
    if (action && /clone|edit|publish|create|accept/.test(action)) writes.push(action);
  });
  async function choose(label: string, value: string) {
    const select = page.getByRole('combobox', { name: new RegExp(`^${label}`) });
    if (!await select.isVisible()) await page.getByRole('button', { name: /^ตัวกรอง/ }).click();
    await select.click(); await page.getByRole('option', { name: value, exact: true }).click();
  }
  try {
    await seedAdminSession(page); await page.goto('/admin');
    await page.getByLabel('ค้นหาข้อมูลประกอบ', { exact: true }).fill('รายชื่ออำเภอและตำบล');
    await page.getByRole('button', { name: 'เปิดข้อมูล', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'รายชื่ออำเภอและตำบล', level: 1, exact: true })).toBeVisible();
    await expect(page.locator('.cms-resource-metrics')).toContainText('289');
    await expect(page.locator('.cms-reference-table tbody tr')).toHaveCount(20);
    await expect(page.getByText('หน้า 1 / 15', { exact: true })).toBeVisible();
    const rowCheckboxes = page.locator('.cms-reference-table tbody input[type="checkbox"]');
    const pageCheckbox = page.getByRole('checkbox', { name: 'เลือกทุกรายการในหน้านี้', exact: true });
    await expect(rowCheckboxes).toHaveCount(0);
    await expect(pageCheckbox).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'เลือกเพื่อดาวน์โหลด', exact: true })).toBeVisible();
    if (info.project.name === 'mobile') {
      const detail = page.getByRole('button', { name: 'ดูรายละเอียด', exact: true }).first();
      const dimensions = await detail.evaluate(element => ({
        button: element.getBoundingClientRect().toJSON(), row: element.closest('tr')!.getBoundingClientRect().toJSON(),
      }));
      expect(dimensions.button.width).toBeLessThan(dimensions.row.width * 0.7);
      expect(dimensions.button.height).toBeGreaterThanOrEqual(44);
    }
    if (info.project.name === 'mobile') {
      await page.getByRole('button', { name: 'เปิดเมนูหลัก', exact: true }).click();
      await expect(page.locator('#sidebar-navigation')).toBeVisible();
      await page.getByRole('button', { name: 'ปิดเมนูหลัก', exact: true }).click();
    }
    await page.evaluate(() => document.fonts.ready);
    await page.locator('.brand-mark img').evaluate((image: HTMLImageElement) => image.decode());
    await page.mouse.move(0, 0);
    await page.screenshot({ path: info.outputPath('resource-detail-full.png'), fullPage: true });
    await page.screenshot({ path: info.outputPath('resource-detail-viewport.png') });
    await writeFile(info.outputPath('geometry.json'), JSON.stringify(await page.evaluate(() => {
      const list = document.querySelector('.cms-records-scroll')!;
      return { url: location.href, width: innerWidth, height: innerHeight, pageHeight: document.documentElement.scrollHeight,
        pageOverflow: document.documentElement.scrollWidth > innerWidth, listHeight: list.clientHeight, listScrollHeight: list.scrollHeight,
        rowCount: list.querySelectorAll('tbody tr').length, viewport: list.getBoundingClientRect().toJSON() };
    }), null, 2));
    const startSelection = page.getByRole('button', { name: 'เลือกเพื่อดาวน์โหลด', exact: true });
    await startSelection.focus(); await page.keyboard.press('Enter');
    await expect(rowCheckboxes).toHaveCount(20);
    if (info.project.name === 'mobile') await expect(page.getByText('เลือกทั้งหน้านี้', { exact: true })).toBeVisible();
    await rowCheckboxes.first().check();
    await page.mouse.move(0, 0);
    await page.screenshot({ path: info.outputPath('resource-detail-selected-full.png'), fullPage: true });
    const firstName = await rowCheckboxes.first().getAttribute('aria-label');
    expect(await pageCheckbox.evaluate((input: HTMLInputElement) => input.indeterminate)).toBe(true);
    await page.getByRole('button', { name: 'ข้อมูลหน้าถัดไป', exact: true }).click();
    await rowCheckboxes.last().check();
    const secondName = await rowCheckboxes.last().getAttribute('aria-label');
    expect(await page.locator('.cms-records-scroll').evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    await expect(page.getByText('เลือก 2 รายการ (รวมทุกหน้า)', { exact: true })).toBeVisible();
    await choose('เรียงลำดับ', 'รหัสตำบล (มาก→น้อย)');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'ดาวน์โหลดที่เลือก (CSV)', exact: true }).click();
    const download = await downloadPromise; const stream = await download.createReadStream(); const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
    const csv = Buffer.concat(chunks).toString('utf8');
    expect(csv.startsWith('\uFEFF')).toBe(true); expect(csv.split('\r\n')).toHaveLength(3);
    for (const name of [firstName, secondName]) expect(csv).toContain(name!.split(' · ').at(-1));
    await page.getByRole('button', { name: 'ล้างรายการที่เลือก', exact: true }).click();
    const exportButton = page.locator('.cms-record-selection button').filter({ hasText: 'ดาวน์โหลดที่เลือก (CSV)' });
    await expect(exportButton).toBeDisabled();
    if (info.project.name === 'mobile') await expect(exportButton).toBeHidden();
    await rowCheckboxes.first().check();
    await page.getByRole('button', { name: 'ยกเลิกการเลือก', exact: true }).click();
    await expect(rowCheckboxes).toHaveCount(0);
    await expect(pageCheckbox).toHaveCount(0);
    await startSelection.click();
    await expect(page.locator('.cms-reference-table tbody input[type="checkbox"]:checked')).toHaveCount(0);
    await expect(exportButton).toBeDisabled();
    await choose('อำเภอ', 'ปากช่อง');
    await expect(page.getByText('พบ 12 จาก 289 รายการ', { exact: true })).toBeVisible();
    await expect(page.locator('.cms-reference-table tbody tr')).toHaveCount(12);
    await pageCheckbox.check();
    await expect(page.getByText('เลือก 12 รายการ (รวมทุกหน้า)', { exact: true })).toBeVisible();
    await page.getByLabel('ค้นหาในข้อมูลชุดนี้', { exact: true }).fill('ไม่มีตำบลชื่อนี้');
    await expect(page.getByRole('heading', { name: 'ไม่พบรายการตามคำค้น', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'ล้างตัวกรอง', exact: true }).last().click();
    await expect(exportButton).toBeDisabled();
    await page.getByRole('button', { name: 'ยกเลิกการเลือก', exact: true }).click();
    await expect(rowCheckboxes).toHaveCount(0);
    await choose('จำนวนรายการต่อหน้า', '10 ต่อหน้า');
    await expect(page.getByText('หน้า 1 / 29', { exact: true })).toBeVisible();
    const open = page.getByRole('button', { name: 'ดูรายละเอียด', exact: true }).first();
    await open.focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'รายละเอียดรายการ', exact: true })).toContainText('300101');
    await page.keyboard.press('Escape'); await expect(open).toBeFocused();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'รายชื่ออำเภอและตำบล', exact: true })).toBeVisible();
    await page.locator('summary').filter({ hasText: 'ประวัติและไฟล์ต้นฉบับ' }).click();
    await expect(page.getByRole('button', { name: 'ดาวน์โหลดไฟล์ข้อมูล (JSON)', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (info.project.name === 'desktop') {
      await page.setViewportSize({ width: 900, height: 1000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.locator('.cms-reference-context').getByRole('link', { name: 'จัดการข้อมูล', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'จัดการข้อมูล', exact: true })).toBeVisible();
    expect(errors).toEqual([]); expect(writes).toEqual([]);
  } finally { await database.close(); }
});
