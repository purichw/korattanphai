import { readFileSync } from 'node:fs';
import { test, expect, seedAuthSession } from './fixtures';
import { forecastSlice } from '../tests/fixtures/forecast-slice.mjs';

const overview = JSON.parse(readFileSync('src/data/generated/forecast-overview-t1.json', 'utf8'));
test.beforeEach(async ({ page }) => {
  await seedAuthSession(page);
  await page.route('https://ktp-auth-test.supabase.co/rest/v1/rpc/ktp_load_forecast_slice', route => route.fulfill({ json: forecastSlice(overview, route.request().postDataJSON()) }));
});

test('risk lists match the selected forecast and scroll inside a bounded card', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?mapLayer=forecast-archive&target=2025-03&horizon=1');
  const card = page.locator('.nr-forecast-overview-attention');
  const scroll = card.locator('.nr-home-attention-scroll');
  await expect(card.getByRole('button', {name:'เสี่ยงสูง (75)',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(card.locator('li')).toHaveCount(75);
  await expect(page.locator('.nr-forecast-overview-summary .metric-card-value').first()).toHaveText('75 ตำบล');
  await expect(page.locator('.nr-map-tools')).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  await page.evaluate(()=>document.fonts.ready);
  const before = await card.boundingBox();
  const url = page.url();
  const pageScroll = await page.evaluate(()=>scrollY);
  const bounds = await scroll.evaluate(element=>({client:element.clientHeight,content:element.scrollHeight,overflow:getComputedStyle(element).overflowY}));
  if (page.viewportSize()!.width > 720) {
    const map = await page.locator('.nr-overview-cockpit-map .nr-dashboard-map-card').boundingBox();
    expect(before!.y + before!.height).toBeCloseTo(map!.y + map!.height, 0);
  } else {
    expect(before!.height).toBeLessThanOrEqual(360);
  }
  expect(bounds.content).toBeGreaterThan(bounds.client);
  expect(bounds.overflow).toBe('auto');
  await scroll.focus();
  await page.keyboard.press('End');
  await expect.poll(()=>scroll.evaluate(element=>element.scrollTop)).toBeGreaterThan(0);
  await card.locator('li').last().scrollIntoViewIfNeeded();
  const last = await card.locator('li').last().boundingBox();
  const frame = await scroll.boundingBox();
  expect(last!.y + last!.height).toBeLessThanOrEqual(frame!.y + frame!.height + 1);
  expect(await page.evaluate(()=>scrollY)).toBe(pageScroll);
  await card.getByRole('button',{name:'เสี่ยงปานกลาง (31)',exact:true}).click();
  await expect(card.locator('li')).toHaveCount(31);
  await expect.poll(()=>scroll.evaluate(element=>element.scrollTop)).toBe(0);
  expect((await card.boundingBox())!.height).toBe(before!.height);
  expect(page.url()).toBe(url);
  const expected = overview.locations.filter((location: {subdistrictCode:string})=>overview.packedRiskByTargetMonth['2025-03'][location.subdistrictCode][0]===1)
    .sort((a:{subdistrictCode:string},b:{subdistrictCode:string})=>a.subdistrictCode.localeCompare(b.subdistrictCode));
  await expect(card.locator('li strong')).toHaveText(expected.map((location:{subdistrictNameTh:string})=>`ต.${location.subdistrictNameTh}`));
  await expect(card.locator('li a').first()).toHaveAttribute('href',/target=2025-03&horizon=1/);
  await card.getByRole('button',{name:'เสี่ยงสูง (75)',exact:true}).click();
  await expect(card.locator('li')).toHaveCount(75);
  const shot = await card.boundingBox();
  await page.screenshot({path:info.outputPath('attention-high.png'),clip:{x:Math.max(0,shot!.x-12),y:Math.max(0,shot!.y-12),width:Math.min(page.viewportSize()!.width-Math.max(0,shot!.x-12),shot!.width+24),height:shot!.height+24}});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('moderate-only defaults, empty high state and scope/month changes stay consistent', async ({ page }, info) => {
  test.setTimeout(60000);
  await page.goto('/?mapLayer=forecast-archive&target=2025-12&horizon=1');
  const card = page.locator('.nr-forecast-overview-attention');
  await expect(card.getByRole('button',{name:'เสี่ยงปานกลาง (117)',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(card.locator('li')).toHaveCount(117);
  await page.locator('.nr-map-tools').waitFor();
  await card.scrollIntoViewIfNeeded();
  await page.evaluate(() => document.fonts.ready);
  const shot = await card.boundingBox();
  await page.screenshot({path:info.outputPath('attention-moderate.png'),clip:{x:Math.max(0,shot!.x-12),y:Math.max(0,shot!.y-12),width:Math.min(page.viewportSize()!.width-Math.max(0,shot!.x-12),shot!.width+24),height:shot!.height+24}});
  await card.getByRole('button',{name:'เสี่ยงสูง (0)',exact:true}).click();
  await expect(card.getByRole('status')).toContainText('ไม่พบตำบลที่พยากรณ์เสี่ยงสูง');
  await expect(card.getByRole('status')).toContainText('เสี่ยงปานกลาง 117 ตำบล');
  const emptyCard = await card.boundingBox();
  expect(emptyCard!.height).toBeCloseTo(shot!.height, 0);
  if (page.viewportSize()!.width > 720) {
    const map = await page.locator('.nr-overview-cockpit-map .nr-dashboard-map-card').boundingBox();
    expect(emptyCard!.y + emptyCard!.height).toBeCloseTo(map!.y + map!.height, 0);
  }
  await page.screenshot({path:info.outputPath('attention-empty-map-alignment.png'),fullPage:true});
  const edit = page.getByRole('button',{name:'แก้ไขตัวกรองข้อมูล'});
  if(await edit.isVisible()) await edit.click();
  await page.getByRole('combobox',{name:/^(เลือก)?อำเภอ/}).click();
  await page.getByRole('option',{name:'ด่านขุนทด',exact:true}).click();
  const apply=page.getByRole('button',{name:'แสดงผล',exact:true});
  if(await apply.isVisible()) await apply.click();
  await expect(card.getByRole('button',{name:'เสี่ยงปานกลาง (6)',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(card.locator('li')).toHaveCount(6);
  await expect(card.locator('li small')).toHaveText(Array(6).fill('อ.ด่านขุนทด'));
  if(await edit.isVisible()) await edit.click();
  await page.getByRole('combobox',{name:/^เดือนตั้งต้น |^เลือกเดือนตั้งต้น$/}).click();
  await page.getByRole('option',{name:'มี.ค. 2568',exact:true}).click();
  if(await apply.isVisible()) await apply.click();
  const expected=overview.locations.filter((location:{districtCode:string,subdistrictCode:string})=>location.districtCode==='3008'&&overview.packedRiskByTargetMonth['2025-03'][location.subdistrictCode][0]===2);
  expect(expected.length).toBeGreaterThan(0);
  await expect(card.getByRole('button',{name:`เสี่ยงสูง (${expected.length})`,exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(card.locator('li')).toHaveCount(expected.length);
  await expect(card.locator('.nr-home-attention-context')).toContainText('เม.ย. 2568');
  await expect(card.locator('li a').first()).toHaveAttribute('href',/target=2025-03&horizon=1/);
  await page.reload();
  await expect(card.locator('li')).toHaveCount(expected.length);
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath('attention-scope.png')});
});
