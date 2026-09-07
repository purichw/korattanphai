import { readFileSync } from 'node:fs';
import { expect, test, seedAuthSession } from './fixtures';
import { forecastSlice } from '../tests/fixtures/forecast-slice.mjs';

const source = JSON.parse(readFileSync('data/normalized/drought-rev03/forecast_archive.json', 'utf8'));
const runtime = JSON.parse(readFileSync('src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json', 'utf8'));
const overview = JSON.parse(readFileSync('src/data/generated/forecast-overview-t1.json', 'utf8'));
const colors: Record<string, string> = { '0': 'rgb(93, 174, 121)', '1': 'rgb(241, 184, 75)', '2': 'rgb(217, 93, 89)' };
const statuses: Record<string, string> = { '0': 'no-risk', '1': 'moderate', '2': 'high', null: 'out-of-scope' };

test.beforeEach(async ({ page }) => {
  await page.route('https://ktp-auth-test.supabase.co/rest/v1/rpc/ktp_load_forecast_slice', (route) => {
    expect(route.request().postDataJSON().p_version).toBe('drought-rev03-a3be44486c8e');
    return route.fulfill({ json: forecastSlice(route.request().postDataJSON().p_horizon_count === 1 ? overview : runtime, route.request().postDataJSON()) });
  });
  await seedAuthSession(page);
});

for (const scope of [
  { name: 'province', path: '/drought', code: '' },
  { name: 'district', path: '/dan-khun-thot', code: '3008' },
  { name: 'subdistrict', path: '/dan-khun-thot/t-300806', code: '300806' },
]) {
  test(`rev03 ${scope.name}: every rendered polygon uses the original source/T+ value`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const period of ['2015-06', '2025-12']) {
      await page.goto(`${scope.path}?target=${period}&horizon=1`);
      const codes = runtime.locations.filter((l: any) => l.subdistrictCode.startsWith(scope.code));
      for (const horizon of [1, 2, 3, 4, 5, 6]) {
        await page.locator('.nr-forecast-archive-horizon-tabs').getByRole('tab', { name: new RegExp(`T\\+${horizon}(?:\\s|$)`) }).click();
        await expect(page).toHaveURL(new RegExp(`target=${period}&horizon=${horizon}`));
        const expected = Object.fromEntries(codes.map((l: any) => {
          const risk = source.packedRiskBySourceMonth[period][l.sourceId][horizon - 1];
          return [l.subdistrictCode, { status: statuses[String(risk)], color: risk === null ? null : colors[String(risk)] }];
        }));
        await expect.poll(async () => page.locator('.nr-map-shape:not(.is-criteria-filtered)').evaluateAll((elements, expected) => {
          const actual = Object.fromEntries(elements.map((element) => [element.getAttribute('data-nr-subdistrict-code'), element]));
          return Object.keys(actual).length === Object.keys(expected).length && Object.entries(expected).every(([code, value]) => {
            const element = actual[code];
            if (!element?.classList.contains(`is-forecast-${value.status}`)) return false;
            const fill = getComputedStyle(element).fill;
            return value.color === null ? fill.includes('url(') : fill === value.color;
          });
        }, expected)).toBe(true);
      }
    }
    await page.locator('.nr-map-panel').scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`rev03-${scope.name}-t6.png`), fullPage: true });
    expect(errors).toEqual([]);
  });
}

test('rev03 Home T+1 counts and changed month are source-backed, not an old cache', async ({ page }, testInfo) => {
  for (const [period, expected] of [['2025-12', ['0 ตำบล', '117 ตำบล', '0 ตำบล', '172 ตำบล']],
    ['2025-11', ['0 ตำบล', '48 ตำบล', '69 ตำบล', '172 ตำบล']]] as const) {
    await page.goto(`/?target=${period}&horizon=1`);
    await expect(page.locator('.nr-forecast-overview-summary .metric-card-value')).toHaveText([...expected]);
    await expect(page.locator('.nr-map-shape.is-forecast-high')).toHaveCount(0);
    await expect(page.locator('.nr-map-shape.is-forecast-out-of-scope')).toHaveCount(172);
  }
  await page.screenshot({ path: testInfo.outputPath('rev03-home-nov2025.png'), fullPage: true });
});
