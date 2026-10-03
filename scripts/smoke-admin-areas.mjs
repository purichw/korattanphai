import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export async function smokeAdminAreas({ page, expect, device, viewport, output }) {
  const resources = new Map();
  const reads = [];
  const capture = response => {
    if (new URL(response.url()).searchParams.get('action') === 'resource-get' && response.ok()) {
      reads.push(response.json().then(data => { if (data.resource_key) resources.set(data.resource_key, data); }));
    }
  };
  page.on('response', capture);
  const choose = async (label, value) => {
    const select = page.getByRole('combobox', { name: new RegExp(`^${label}`) });
    if (!await select.isVisible()) await page.getByRole('button', { name: /^ตัวกรอง/ }).click();
    await select.click(); await page.getByRole('option', { name: value, exact: true }).click();
    await expect(select).toBeFocused();
  };
  const download = async button => {
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: button, exact: true }).click();
    const file = await pending;
    assert.equal(await file.failure(), null);
    return readFile(await file.path(), 'utf8');
  };
  const shot = async name => {
    await page.evaluate(() => { document.activeElement?.blur?.(); scrollTo(0, 0); });
    await page.mouse.move(0, 0);
    const file = path.join(output, `${device}-areas-${name}.png`);
    await page.screenshot({ path: file, fullPage: !name.startsWith('dialog') });
    return file;
  };
  try {
    await page.getByRole('button', { name: 'เปิดข้อมูล', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'ข้อมูลพื้นที่', level: 1 })).toBeVisible();
    await expect(page.locator('.cms-area-workspace')).toHaveAttribute('aria-busy', 'false');
    await Promise.all(reads);
    const names = resources.get('canonical/nakhon_ratchasima/admin_hierarchy');
    const boundaries = resources.get('geodata/nakhon-ratchasima-subdistricts');
    assert.ok(names && boundaries, 'Both independent CMS resources must load.');
    await expect(page.locator('.cms-area-results')).toContainText('พบ 289 จาก 289 รายการ · 32 อำเภอ');
    await expect(page.locator('.cms-area-group')).toHaveCount(4);
    await expect(page.getByText('หน้า 1 / 8', { exact: true })).toBeVisible();
    await expect(page.locator('.cms-area-table input')).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
    await page.locator('.brand-mark img').evaluate(image => image.decode());
    const listScreenshot = await shot('list');
    const geometry = await page.locator('.cms-area-groups').evaluate(list => ({
      pageOverflow: document.documentElement.scrollWidth > innerWidth,
      listHeight: list.clientHeight, listScrollHeight: list.scrollHeight,
    }));
    assert.equal(geometry.pageOverflow, false);
    assert.ok(geometry.listScrollHeight > geometry.listHeight);
    await page.getByRole('button', { name: 'ย่อทุกกลุ่ม', exact: true }).click();
    await expect(page.locator('.cms-area-group-heading button[aria-expanded="false"]')).toHaveCount(4);
    await page.getByRole('button', { name: 'ขยายทุกกลุ่ม', exact: true }).click();
    await choose('อำเภอ', 'ปากช่อง');
    await expect(page.locator('.cms-area-table tbody tr')).toHaveCount(12);
    await choose('ตำบล', 'หนองสาหร่าย 302106 · ปากช่อง');
    await expect(page.locator('.cms-area-table tbody tr')).toHaveCount(1);
    const opener = page.getByRole('button', { name: 'ดูรายละเอียด หนองสาหร่าย 302106', exact: true });
    if (device === 'mobile') assert.ok((await opener.boundingBox()).height >= 44);
    await opener.focus(); await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'ตำบลหนองสาหร่าย', exact: true });
    await expect(dialog).toHaveAccessibleDescription('อ.ปากช่อง · 302106');
    assert.equal(await dialog.evaluate(element => element.matches(':modal')), true);
    await expect(dialog.locator('dd')).toHaveText(['นครราชสีมา', 'ปากช่อง', 'หนองสาหร่าย', '302106']);
    await expect(dialog).toContainText(`รุ่นแก้ไข ${names.revision}`);
    await dialog.getByRole('button', { name: 'ขอบเขตแผนที่', exact: true }).click();
    await expect(dialog.locator('.cms-area-map-canvas > svg > g > path')).toHaveCount(1);
    await expect(dialog).toContainText('DOPA');
    const dialogScreenshot = await shot('dialog-map');
    if (device === 'mobile') {
      await page.setViewportSize({ width: viewport.width, height: 480 });
      const bounds = await dialog.boundingBox();
      assert.ok(Math.abs(bounds.x) <= 1 && Math.abs(bounds.width - viewport.width) <= 1);
      assert.ok(Math.abs(bounds.y + bounds.height - 480) <= 1);
      const content = dialog.locator('.nr-tool-dialog-content');
      assert.ok(await content.evaluate(element => element.scrollHeight > element.clientHeight));
      await content.evaluate(element => { element.scrollTop = element.scrollHeight; });
      await expect(dialog.getByRole('button', { name: 'ปิด', exact: true })).toBeInViewport();
    }
    await page.keyboard.press('Escape'); await expect(opener).toBeFocused();
    if (device === 'mobile') await page.setViewportSize(viewport);
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'ปิดรายละเอียดพื้นที่', exact: true }).click();
    await expect(opener).toBeFocused(); await page.keyboard.press('Enter');
    await dialog.getByRole('button', { name: 'ปิด', exact: true }).click(); await expect(opener).toBeFocused();
    await page.getByRole('button', { name: 'ล้างตัวกรอง', exact: true }).click();
    await page.getByRole('button', { name: 'เลือกเพื่อดาวน์โหลด', exact: true }).click();
    const checks = page.locator('.cms-area-table tbody input');
    const codes = [];
    for (let i = 0; i < 2; i++) {
      await checks.first().check(); codes.push((await checks.first().getAttribute('aria-label')).split(' ').at(-1));
      if (!i) await page.getByRole('button', { name: 'ข้อมูลหน้าถัดไป', exact: true }).click();
    }
    await choose('เรียงลำดับ', 'รหัสพื้นที่ มากไปน้อย');
    const csv = await download('รายชื่อ (CSV)');
    assert.ok(csv.startsWith('\uFEFF')); assert.equal(csv.split('\r\n').length, 3);
    codes.forEach(code => assert.ok(csv.includes(`"${code}"`)));
    await page.getByRole('button', { name: 'ล้างรายการที่เลือก', exact: true }).click();
    await expect(page.getByRole('button', { name: 'รายชื่อ (CSV)', exact: true })).toBeDisabled();
    await checks.first().check();
    await page.getByRole('button', { name: 'ยกเลิกการเลือก', exact: true }).click();
    await page.getByRole('button', { name: 'เลือกเพื่อดาวน์โหลด', exact: true }).click();
    await expect(page.locator('.cms-area-table tbody input:checked')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'รายชื่อ (CSV)', exact: true })).toBeDisabled();
    await choose('อำเภอ', 'ปากช่อง');
    await page.getByRole('checkbox', { name: 'เลือกกลุ่ม ปากช่อง', exact: true }).check();
    const geojson = JSON.parse(await download('ขอบเขต (GeoJSON) · 12'));
    assert.equal(geojson.features.length, 12);
    for (const feature of geojson.features) assert.deepEqual(feature, boundaries.payload.features.find(item => item.properties.Admin_code === feature.properties.Admin_code));
    await page.getByRole('button', { name: 'แผนที่', exact: true }).click();
    await expect(page.getByText('เลือก 12 รายการ (รวมทุกหน้า)', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'ยกเลิกการเลือก', exact: true }).click();
    const paths = page.locator('.cms-area-map-canvas > svg > g > path');
    await expect(paths).toHaveCount(12);
    await expect(page.locator('.cms-area-map-label').first()).toBeVisible();
    const transform = page.locator('.cms-area-map-canvas > svg > g');
    const originalTransform = await transform.getAttribute('transform');
    await page.getByRole('button', { name: 'ขยายแผนที่ขอบเขต', exact: true }).click();
    await expect(transform).not.toHaveAttribute('transform', originalTransform);
    await page.getByRole('button', { name: 'แสดงขอบเขตทั้งหมด', exact: true }).click();
    await expect(transform).toHaveAttribute('transform', originalTransform);
    const mapScreenshot = await shot('map');
    await paths.first().focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible(); await page.keyboard.press('Escape');
    await expect(paths.first()).toBeFocused();
    await page.getByLabel('ค้นหาพื้นที่', { exact: true }).fill('ไม่มีพื้นที่นี้');
    await expect(page.getByRole('heading', { name: 'ไม่พบพื้นที่ตามตัวกรองนี้', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'ล้างตัวกรอง', exact: true }).last().click();
    await page.getByRole('button', { name: 'รายชื่อ', exact: true }).click();
    await page.getByLabel('ค้นหาพื้นที่', { exact: true }).fill('๓๐๐๑๐๑');
    await expect(page.locator('.cms-area-table tbody tr')).toHaveCount(1);
    await page.reload();
    await expect(page.locator('.cms-area-results')).toContainText('พบ 289 จาก 289 รายการ · 32 อำเภอ');
    await page.locator('summary').filter({ hasText: 'ประวัติและไฟล์ต้นฉบับ' }).click();
    const source = page.locator('.cms-area-source').filter({ has: page.getByRole('heading', { name: 'ขอบเขตตำบล', exact: true }) });
    const fileReady = page.waitForEvent('download');
    await source.getByRole('button', { name: 'ไฟล์ต้นฉบับ (JSON)', exact: true }).click();
    assert.deepEqual(JSON.parse(await readFile(await (await fileReady).path(), 'utf8')), boundaries.payload);
    await source.getByRole('button', { name: 'ประวัติการแก้ไข', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'ประวัติ ขอบเขตตำบล' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.goto(new URL(`/admin?resource=${boundaries.id}`, page.url()).href);
    await expect(page.getByRole('button', { name: 'แผนที่', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.cms-area-map-canvas > svg > g > path')).toHaveCount(289);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.locator('.cms-reference-context').getByRole('link', { name: 'จัดการข้อมูล', exact: true }).click();
    return { status: 'passed', areas: 289, districts: 32, selectedCsvRows: 2, selectedGeometryCount: 12,
      sourceRevisions: [names.revision, boundaries.revision], originalJson: 'unchanged', geometry,
      filters: 'passed', grouping: 'passed', map: 'passed', keyboardFocus: 'passed', mobileSheet: 'passed',
      screenshots: { listScreenshot, mapScreenshot, dialogScreenshot } };
  } finally { page.off('response', capture); }
}
