import { readFileSync } from 'node:fs';
import { mockSupabase, seedAuthSession, authTestUser } from './supabase.mjs';
import { forecastRevision, forecastSlice } from './forecast-slice.mjs';

const archive = JSON.parse(readFileSync(new URL('../../src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json', import.meta.url), 'utf8'));
const overview = JSON.parse(readFileSync(new URL('../../src/data/generated/forecast-overview-t1.json', import.meta.url), 'utf8'));
export const bookmarkDatasetId = archive.meta.datasetId;

// Browser-only mock: bookmarks remain in memory, never in a real account.
export async function mockBookmarks(context) {
  await mockSupabase(context);
  await seedAuthSession(context);
  const state = { areas: [], filters: [], delay: 0, fail: false, serial: 0 };
  await context.route('https://ktp-auth-test.supabase.co/rest/v1/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.endsWith('/rpc/ktp_latest_forecast_revision')) return route.fulfill({ json: forecastRevision(archive) });
    if (url.pathname.endsWith('/rpc/ktp_load_forecast_slice')) {
      const params = request.postDataJSON();
      return route.fulfill({ json: forecastSlice(params.p_horizon_count === 1 ? overview : archive, params) });
    }
    const isArea = url.pathname.endsWith('/ktp_followed_areas');
    if (!isArea && !url.pathname.endsWith('/ktp_saved_filters')) return route.abort();
    if (state.delay) await new Promise(resolve => setTimeout(resolve, state.delay));
    if (state.fail) return route.fulfill({ status: 503, json: { message: 'Test-only bookmark failure' } });
    const rows = isArea ? state.areas : state.filters;
    if (request.method() === 'GET') return route.fulfill({ json: rows });
    if (request.method() === 'POST') {
      const row = request.postDataJSON();
      if (row.user_id !== authTestUser.id) return route.abort();
      rows.unshift({ ...row, id: `00000000-0000-4000-8000-${String(++state.serial).padStart(12, '0')}`, created_at: '2026-09-07T00:00:00Z' });
      return route.fulfill({ status: 201, json: null });
    }
    if (request.method() === 'DELETE') {
      const key = isArea ? 'area_code' : 'id';
      const index = rows.findIndex(row => row[key] === url.searchParams.get(key)?.slice(3));
      return route.fulfill({ json: index < 0 ? [] : rows.splice(index, 1) });
    }
    return route.abort();
  });
  return state;
}
