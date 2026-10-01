import { test, expect, seedAdminSession, adminAuthStorageKey, type Page } from './fixtures';
import { cmsTestDatabase } from '../tests/fixtures/admin-data.mjs';
import { contentHash } from '../server/admin-data/contract.mjs';
import type { BrowserContext } from '@playwright/test';

test.skip(process.env.PLAYWRIGHT_REFERENCE_BACKEND !== 'cms', 'Requires the dedicated CMS build and database fixture');

async function watchStartup(page: Page) {
  await expect(page.locator('.app-startup')).toHaveCount(0);
  await page.evaluate(() => {
    const evidence = { appearances: 0, events: [] as string[] };
    Object.assign(window, { adminResumeEvidence: evidence });
    new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) {
        if (node instanceof Element && (node.matches('.app-startup') || node.querySelector('.app-startup'))) evidence.appearances += 1;
      }
    }).observe(document.body, { childList: true, subtree: true });
  });
}

async function watchSessionEvents(page: Page) {
  await page.evaluate(key => {
    const channel = new BroadcastChannel(key);
    channel.addEventListener('message', event => {
      (window as unknown as { adminResumeEvidence: { events: string[] } }).adminResumeEvidence.events.push(event.data.event);
    });
    Object.assign(window, { adminResumeChannel: channel });
  }, adminAuthStorageKey);
}

async function sessionEvent(sender: Page, page: Page, event: 'SIGNED_IN' | 'TOKEN_REFRESHED' | 'SIGNED_OUT') {
  const previous = await page.evaluate(() => (window as unknown as { adminResumeEvidence: { events: string[] } }).adminResumeEvidence.events.length);
  await sender.evaluate(({ key, event }) => {
    const session = event === 'SIGNED_OUT' ? null : JSON.parse(localStorage.getItem(key)!);
    if (event === 'SIGNED_OUT') localStorage.removeItem(key);
    const channel = new BroadcastChannel(key);
    channel.postMessage({ event, session });
    channel.close();
  }, { key: adminAuthStorageKey, event });
  await expect.poll(() => page.evaluate(() => (window as unknown as { adminResumeEvidence: { events: string[] } }).adminResumeEvidence.events.length)).toBe(previous + 1);
  // Allow the SDK notification and React's queued update to reach the next paint.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

async function noNewStartup(page: Page) {
  await expect(page.locator('.app-startup')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { adminResumeEvidence: { appearances: number } }).adminResumeEvidence.appearances)).toBe(0);
}

async function openAwayTab(page: Page) {
  await page.context().route('**/__admin-resume-away', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Another browser tab</title><p>Another browser tab</p>' }));
  const away = await page.context().newPage();
  await away.goto('/__admin-resume-away');
  await away.bringToFront();
  await page.bringToFront();
  return away;
}

async function delayAdminReads(context: BrowserContext) {
  let actions = new Set<string>();
  let arrived = new Set<string>();
  let pending = Promise.resolve();
  let release = () => {};
  await context.route('**/api/admin-data**', async route => {
    const action = new URL(route.request().url()).searchParams.get('action') ?? '';
    if (actions.has(action)) { arrived.add(action); await pending; }
    await route.fallback();
  });
  return {
    hold(...nextActions: string[]) {
      release();
      actions = new Set(nextActions); arrived = new Set();
      pending = new Promise<void>(resolve => { release = resolve; });
    },
    async waitFor(...expectedActions: string[]) {
      await expect.poll(() => expectedActions.every(action => arrived.has(action))).toBe(true);
    },
    release() { actions.clear(); release(); },
  };
}

test('returning to a browser tab and same-user session events retain the loaded Admin view', async ({ page, context }, testInfo) => {
  test.setTimeout(120000);
  const database = await cmsTestDatabase(context, { references: true });
  const reads: string[] = [];
  page.on('request', request => { if (request.url().includes('/api/admin-data')) reads.push(request.url()); });
  try {
    await seedAdminSession(page); await page.goto('/admin');
    const search = page.getByLabel('ค้นหาข้อมูลประกอบ', { exact: true });
    await search.fill('แหล่งข้อมูลอ้างอิง');
    const original = await search.elementHandle();
    const before = reads.length;
    await watchStartup(page); await watchSessionEvents(page);
    const away = await openAwayTab(page);
    await expect(search).toHaveValue('แหล่งข้อมูลอ้างอิง');
    for (const event of ['SIGNED_IN', 'TOKEN_REFRESHED', 'SIGNED_IN'] as const) {
      await sessionEvent(away, page, event);
      await expect(search).toHaveValue('แหล่งข้อมูลอ้างอิง');
      expect(await original!.evaluate(element => element.isConnected)).toBe(true);
      await noNewStartup(page);
    }
    expect(reads).toHaveLength(before);
    await page.screenshot({ path: testInfo.outputPath('admin-tab-return.png'), fullPage: true });
    await sessionEvent(away, page, 'SIGNED_OUT');
    await expect(page.getByRole('heading', { name: 'เข้าสู่ระบบผู้ดูแล', exact: true })).toBeVisible();
    await expect(page.locator('.cms-workspace')).toHaveCount(0);
    await expect(search).toHaveCount(0);
    await away.close();
  } finally { await database.close(); }
});

test('an unsaved source edit survives browser tab return and token refresh before saving', async ({ page, context }, testInfo) => {
  test.setTimeout(120000);
  const database = await cmsTestDatabase(context, { references: true });
  const reads: string[] = [];
  page.on('request', request => { if (request.url().includes('/api/admin-data')) reads.push(request.url()); });
  try {
    const draft = await database.operation('resource:clone', { key: 'canonical/source_registry' });
    const originalPayload = structuredClone(draft.payload);
    await seedAdminSession(page); await page.goto(`/admin?resource=${draft.id}`);
    await page.getByRole('button', { name: 'แก้ไข', exact: true }).first().click();
    const name = page.getByLabel('ชื่อแหล่งข้อมูล', { exact: true });
    const updated = `${originalPayload[0].nameTh} [tab return test]`;
    await name.fill(updated);
    await page.getByLabel('เหตุผลการแก้ไขข้อมูลอ้างอิง', { exact: true }).fill('แก้ไขต่อหลังกลับเข้าแท็บทดสอบ');
    const original = await name.elementHandle();
    const before = reads.length;
    await watchStartup(page); await watchSessionEvents(page);
    const away = await openAwayTab(page);
    for (const event of ['SIGNED_IN', 'TOKEN_REFRESHED'] as const) {
      await sessionEvent(away, page, event);
      await expect(name).toHaveValue(updated);
      await expect(page.getByLabel('เหตุผลการแก้ไขข้อมูลอ้างอิง', { exact: true })).toHaveValue('แก้ไขต่อหลังกลับเข้าแท็บทดสอบ');
      expect(await original!.evaluate(element => element.isConnected)).toBe(true);
      await noNewStartup(page);
    }
    expect(reads).toHaveLength(before);
    expect((await database.operation('resource:get', { id: draft.id })).payload).toEqual(originalPayload);
    await page.screenshot({ path: testInfo.outputPath('admin-unsaved-edit-return.png') });
    await page.getByRole('button', { name: 'บันทึกฉบับร่าง', exact: true }).click();
    await expect(page.getByText('บันทึกข้อมูลอ้างอิงฉบับร่างแล้ว', { exact: true })).toBeVisible();
    expect((await database.operation('resource:get', { id: draft.id })).payload[0].nameTh).toBe(updated);
    expect((await database.operation('resource:get', { id: draft.base_id })).payload).toEqual(originalPayload);
    await away.close();
  } finally { await database.close(); }
});

test('returning from imports keeps loaded Admin panels visible while their latest data is pending', async ({ page, context }, testInfo) => {
  test.setTimeout(120000);
  const database = await cmsTestDatabase(context, { references: true });
  let release = () => {};
  const held = new Promise<void>(resolve => { release = resolve; });
  let holdCatalog = false;
  await context.route('**/api/admin-data**', async route => {
    const action = new URL(route.request().url()).searchParams.get('action');
    if (holdCatalog && ['resource-catalog', 'forecast-catalog'].includes(action ?? '')) await held;
    await route.fallback();
  });
  const navigate = async (label: string) => {
    const menu = page.getByRole('button', { name: 'เปิดเมนูหลัก', exact: true });
    if (await menu.isVisible()) await menu.click();
    await page.locator('.admin-navigation').getByRole('link', { name: label, exact: true }).click();
  };
  try {
    await seedAdminSession(page); await page.goto('/admin');
    await expect(page.locator('.cms-resource-group')).toHaveCount(3);
    await navigate('รายการนำเข้าและฉบับร่าง');
    await expect(page.getByRole('heading', { name: 'รายการนำเข้าและฉบับร่าง', exact: true })).toBeVisible();
    await watchStartup(page);
    holdCatalog = true;
    await navigate('จัดการข้อมูล');
    await expect(page.getByRole('heading', { name: 'ข้อมูลประกอบเว็บไซต์', exact: true })).toBeVisible();
    await expect(page.locator('.cms-resource-group')).toHaveCount(3);
    await expect(page.getByRole('heading', { name: 'พยากรณ์ที่แสดงบนเว็บไซต์', exact: true })).toBeVisible();
    await noNewStartup(page);
    await page.screenshot({ path: testInfo.outputPath('admin-warm-navigation.png'), fullPage: true });
    release();
    await expect(page.locator('.cms-reference')).toHaveAttribute('aria-busy', 'false');
    await noNewStartup(page);
  } finally { release(); await database.close(); }
});

test('manual refresh and returning from source detail keep cached panels visible during revalidation', async ({ page, context }, testInfo) => {
  test.setTimeout(120000);
  const database = await cmsTestDatabase(context, { references: true });
  const delay = await delayAdminReads(context);
  try {
    await seedAdminSession(page); await page.goto('/admin');
    const search = page.getByLabel('ค้นหาข้อมูลประกอบ', { exact: true });
    await expect(page.locator('.cms-resource-group')).toHaveCount(3);
    await search.fill('แหล่งข้อมูลอ้างอิง');
    const original = await search.elementHandle();
    await watchStartup(page);
    delay.hold('list', 'forecast-catalog', 'resource-catalog');
    await page.getByRole('button', { name: 'โหลดฉบับล่าสุด', exact: true }).click();
    await delay.waitFor('list', 'forecast-catalog', 'resource-catalog');
    await expect(page.getByRole('heading', { name: 'พยากรณ์ที่แสดงบนเว็บไซต์', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'ข้อมูลประกอบเว็บไซต์', exact: true })).toBeVisible();
    await expect(page.locator('.cms-resource-group')).toHaveCount(1);
    await expect(search).toHaveValue('แหล่งข้อมูลอ้างอิง');
    expect(await original!.evaluate(element => element.isConnected)).toBe(true);
    await noNewStartup(page);
    await page.screenshot({ path: testInfo.outputPath('admin-manual-refresh.png'), fullPage: true });
    delay.release();
    await expect(page.getByRole('button', { name: 'โหลดฉบับล่าสุด', exact: true })).toBeEnabled();
    await expect(page.locator('.cms-reference')).toHaveAttribute('aria-busy', 'false');
    await noNewStartup(page);

    await page.getByRole('button', { name: 'เปิดข้อมูล', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'แหล่งข้อมูลอ้างอิง', exact: true })).toBeVisible();
    await expect(page.locator('.cms-reference-context').getByRole('link', { name: 'จัดการข้อมูล', exact: true })).toBeVisible();
    await watchStartup(page);
    delay.hold('forecast-catalog', 'resource-catalog');
    await page.locator('.cms-reference-context').getByRole('link', { name: 'จัดการข้อมูล', exact: true }).click();
    await delay.waitFor('forecast-catalog', 'resource-catalog');
    await expect(page.getByRole('heading', { name: 'ข้อมูลประกอบเว็บไซต์', exact: true })).toBeVisible();
    await expect(page.locator('.cms-resource-group')).toHaveCount(3);
    await expect(page.getByRole('heading', { name: 'พยากรณ์ที่แสดงบนเว็บไซต์', exact: true })).toBeVisible();
    await noNewStartup(page);
    await page.screenshot({ path: testInfo.outputPath('admin-source-return.png'), fullPage: true });
    delay.release();
    await expect(page.locator('.cms-reference')).toHaveAttribute('aria-busy', 'false');
    await noNewStartup(page);
  } finally { delay.release(); await database.close(); }
});

test('a cached draft stays readable but cannot be edited until its latest revision arrives', async ({ page, context }, testInfo) => {
  test.setTimeout(120000);
  const database = await cmsTestDatabase(context, { references: true });
  const delay = await delayAdminReads(context);
  const payload = { schemaVersion: 1, sourceId: 'resume-test', batchId: 'warm-draft-test', observations: [{
    stationId: 'RESUME-001', observedAt: '2026-09-01T00:00:00Z', metric: 'rainfall', value: 0,
    unit: 'mm', aggregation: 'sum', periodMinutes: 60, quality: 'reported',
  }] };
  try {
    const draft = await database.operation('create', { kind: 'station', title: 'ข้อมูลตรวจวัดทดสอบการกลับเข้าหน้า', sourceFilename: 'resume-test.json', payload, originalHash: contentHash(payload) });
    await seedAdminSession(page); await page.goto(`/admin?draft=${draft.id}`);
    const edit = page.getByRole('button', { name: 'แก้ไขแถว 1', exact: true });
    await expect(edit).toBeEnabled();
    await page.getByRole('button', { name: 'รายการนำเข้าและฉบับร่าง', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'รายการนำเข้าและฉบับร่าง', exact: true })).toBeVisible();
    const updated = structuredClone(payload); updated.observations[0].value = 12;
    await database.operation('edit', { id: draft.id, revision: draft.revision, reason: 'แก้ไขจากหน้าต่างทดสอบอีกหน้าต่าง', payload: updated });
    await watchStartup(page);
    delay.hold('get');
    await page.getByRole('button', { name: draft.title, exact: true }).click();
    await delay.waitFor('get');
    await expect(page.getByRole('heading', { name: draft.title, exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: '0', exact: true })).toBeVisible();
    await expect(edit).toBeDisabled();
    await expect(page.getByRole('button', { name: 'ตรวจข้อมูล', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'รายละเอียดชุดข้อมูล', exact: true })).toBeDisabled();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'บันทึกฉบับร่าง', exact: true })).toHaveCount(0);
    await noNewStartup(page);
    await page.screenshot({ path: testInfo.outputPath('admin-warm-draft-pending.png'), fullPage: true });
    delay.release();
    await expect(page.getByRole('cell', { name: '12', exact: true })).toBeVisible();
    await expect(edit).toBeEnabled();
    await noNewStartup(page);

    delay.hold('get');
    await page.getByRole('button', { name: 'โหลดฉบับล่าสุด', exact: true }).click();
    await delay.waitFor('get');
    await expect(page.getByRole('cell', { name: '12', exact: true })).toBeVisible();
    await expect(edit).toBeDisabled();
    await noNewStartup(page);
    delay.release();
    await expect(edit).toBeEnabled();
    await edit.click();
    await expect(page.getByLabel('ค่าตรวจวัด', { exact: true })).toHaveValue('12');
    await page.getByLabel('ค่าตรวจวัด', { exact: true }).fill('13');
    await page.getByLabel('เหตุผลการแก้ไข', { exact: true }).fill('แก้ไขจากฉบับล่าสุดหลังโหลดเบื้องหลังเสร็จ');
    await page.getByRole('button', { name: 'บันทึกฉบับร่าง', exact: true }).click();
    await expect(page.getByText('บันทึกฉบับร่างแล้ว', { exact: true })).toBeVisible();
    const saved = await database.operation('get', { id: draft.id });
    expect(saved.payload.observations[0].value).toBe(13);
    expect(saved.revision).toBe(draft.revision + 2);
    expect((await database.operation('original', { id: draft.id })).payload).toEqual(payload);
    await noNewStartup(page);
  } finally { delay.release(); await database.close(); }
});
