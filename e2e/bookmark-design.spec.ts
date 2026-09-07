import { test, expect } from '@playwright/test';
import { mockBookmarks, bookmarkDatasetId } from '../tests/fixtures/bookmarks.mjs';
import { authTestUser } from '../tests/fixtures/supabase.mjs';

test.skip(process.env.PLAYWRIGHT_DATA_BACKEND !== 'supabase', 'Requires the database test backend');

test('bookmark tabs, confirmation, failure, and focus remain usable', async ({ page, context }, testInfo) => {
  const state = await mockBookmarks(context);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?target=2025-12&horizon=1');
  await page.locator('.nr-map-shape').first().waitFor();
  const trigger = page.getByRole('button', { name: 'รายการที่บันทึก', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog');
  const follow = dialog.getByRole('button', { name: 'ติดตามพื้นที่นี้', exact: true });
  await expect(follow).toBeEnabled();
  await expect(follow).toHaveClass(/primary-button/);
  await follow.click();
  await expect(dialog.getByRole('status')).toHaveText('เพิ่มพื้นที่ติดตามแล้ว');
  const areaTab = dialog.getByRole('tab', { name: 'พื้นที่ติดตาม', exact: true });
  await areaTab.focus();
  await page.keyboard.press('ArrowRight');
  await expect(dialog.getByRole('tab', { name: 'ตัวกรองที่บันทึก', exact: true })).toBeFocused();
  await expect(dialog.getByRole('status')).toBeEmpty();
  const input = dialog.getByLabel('ชื่อตัวกรอง', { exact: true });
  await input.fill('ติดตามพื้นที่และพยากรณ์ T+1');
  state.fail = true;
  await dialog.getByRole('button', { name: 'บันทึก', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(input).toHaveValue('ติดตามพื้นที่และพยากรณ์ T+1');
  await page.screenshot({ path: testInfo.outputPath('bookmark-error.png') });
  state.fail = false;
  await dialog.getByRole('button', { name: 'ลองใหม่', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  await expect(dialog.getByRole('status')).toBeEmpty();
  await areaTab.click();
  await dialog.getByRole('button', { name: /^ลบ จังหวัดนครราชสีมา/ }).click();
  await expect(dialog.getByText('ลบรายการนี้?', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('bookmark-confirmation.png') });
  await dialog.getByRole('button', { name: 'ยกเลิกการลบ', exact: true }).click();
  expect(state.areas).toHaveLength(1);
  await dialog.getByRole('button', { name: /^ลบ จังหวัดนครราชสีมา/ }).click();
  await dialog.getByRole('button', { name: 'ลบ', exact: true }).click();
  await expect(dialog.getByText('ยังไม่มีพื้นที่ติดตาม', { exact: true })).toBeVisible();
  expect(state.areas).toHaveLength(0);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(errors).toEqual([]);
});

test('long saved names scroll inside the modal without losing the close control', async ({ page, context }, testInfo) => {
  const state = await mockBookmarks(context);
  state.filters = Array.from({ length: 18 }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    user_id: authTestUser.id, name: `รายการ ${index + 1} พื้นที่ติดตามความเสี่ยงภัยแล้งจังหวัดนครราชสีมา`,
    area_code: '30', view_name: 'overview', dataset_id: bookmarkDatasetId,
    target_period: '2025-12-01', horizon: 1, risk_criterion: 'all', irrigation_criterion: 'all',
    created_at: '2026-09-07T00:00:00Z',
  }));
  await page.setViewportSize({ width: page.viewportSize()!.width, height: 600 });
  await page.goto('/?target=2025-12&horizon=1');
  await page.locator('.nr-map-shape').first().waitFor();
  await page.getByRole('button', { name: 'รายการที่บันทึก', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'ติดตามพื้นที่นี้', exact: true })).toBeEnabled();
  await dialog.getByRole('tab', { name: 'ตัวกรองที่บันทึก', exact: true }).click();
  const rows = dialog.locator('.nr-saved-list > li');
  await expect(rows).toHaveCount(18);
  const panel = dialog.getByRole('tabpanel');
  const close = dialog.getByRole('button', { name: 'ปิดรายการที่บันทึก', exact: true });
  const closeBefore = await close.boundingBox();
  await rows.last().scrollIntoViewIfNeeded();
  await expect(rows.last()).toBeInViewport();
  await expect(close).toBeInViewport();
  expect(await close.boundingBox()).toEqual(closeBefore);
  const geometry = await panel.evaluate(element => ({
    clientHeight: element.clientHeight, scrollHeight: element.scrollHeight, scrollTop: element.scrollTop,
    overflowY: getComputedStyle(element).overflowY,
    horizontalOverflow: element.scrollWidth > element.clientWidth,
    pageOverflow: document.documentElement.scrollWidth > innerWidth,
  }));
  expect(geometry.scrollHeight).toBeGreaterThan(geometry.clientHeight);
  expect(geometry.scrollTop).toBeGreaterThan(0);
  expect(geometry.overflowY).toBe('auto');
  expect(geometry.horizontalOverflow).toBe(false);
  expect(geometry.pageOverflow).toBe(false);
  if (testInfo.project.name === 'mobile') {
    expect(closeBefore!.height).toBeGreaterThanOrEqual(44);
    expect(await dialog.getByLabel('ชื่อตัวกรอง').evaluate(element => getComputedStyle(element).fontSize)).toBe('16px');
  }
  await page.screenshot({ path: testInfo.outputPath('bookmark-long-list.png') });
  await testInfo.attach('scroll-geometry', { body: JSON.stringify(geometry), contentType: 'application/json' });
  await close.click();
  await expect(dialog).toHaveCount(0);
});
