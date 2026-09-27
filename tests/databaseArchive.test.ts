import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import archive from '../src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json';
import overview from '../src/data/generated/forecast-overview-t1.json';
import { createSupabaseForecastLoader, validateDatabaseArchive } from '../src/data/supabaseForecastArchive';
import { forecastSlice, forecastRevision } from './fixtures/forecast-slice.mjs';
import { forecastScopeCodes } from '../src/data/forecastScope';
import { forecastTargetPeriod } from '../src/forecastPeriod';

const slice = forecastSlice(archive);
const revision = forecastRevision(archive);

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
function fixture(data: unknown = slice) {
  const getSession = vi.fn().mockResolvedValue({ data: { session: { user: { id: 'a' } } }, error: null });
  const abortSignal = vi.fn().mockResolvedValue({ data, error: null });
  const revisionSignal = vi.fn().mockResolvedValue({ data: forecastRevision(archive), error: null });
  const rpc = vi.fn().mockImplementation(name => ({ abortSignal: name === 'ktp_latest_forecast_revision' ? revisionSignal : abortSignal }));
  const client = { auth: { getSession }, rpc } as unknown as SupabaseClient;
  return { getSession, abortSignal, revisionSignal, rpc, client };
}
describe('Supabase archive loader', () => {
  it('times out session discovery that ignores abort and retries without accepting its late result', async () => {
    vi.useFakeTimers();
    const f = fixture(); let finish!: (value: unknown) => void;
    f.getSession.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const loader = createSupabaseForecastLoader('a', 6, async () => f.client);
    const waiting = expect(loader.load()).rejects.toThrow('Load timed out');
    await vi.advanceTimersByTimeAsync(30_000); await waiting;
    expect(loader.getCached()).toBeNull();
    await expect(loader.load()).resolves.toEqual(slice);
    finish({ data: { session: { user: { id: 'a' } } }, error: null });
    await Promise.resolve(); await Promise.resolve();
    expect(f.revisionSignal).toHaveBeenCalledTimes(1);
    expect(f.abortSignal).toHaveBeenCalledTimes(1);
  });
  it('reuses pending requests and caches only in the current account provider', async () => {
    const f = fixture(); const loader = createSupabaseForecastLoader('a', 6, async () => f.client);
    const first = loader.load(); expect(loader.load()).toBe(first);
    expect(await first).toEqual(slice);
    await loader.load(); expect(f.abortSignal).toHaveBeenCalledTimes(1);
    expect(f.revisionSignal).toHaveBeenCalledTimes(2);
    const other = createSupabaseForecastLoader('b', 6, async () => f.client);
    expect(other.getCached()).toBeNull();
    await expect(other.load()).rejects.toThrow('Session changed');
  });
  it('fails closed after RPC failure with no static fetch fallback, then allows retry', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const f = fixture(); f.abortSignal.mockResolvedValueOnce({ data: null, error: { code: '42501' } });
    const loader = createSupabaseForecastLoader('a', 6, async () => f.client);
    await expect(loader.load()).rejects.toThrow('Forecast database unavailable');
    expect(loader.getCached()).toBeNull(); expect(fetch).not.toHaveBeenCalled();
    await expect(loader.load()).resolves.toEqual(slice);
  });
  it('rejects a delayed response after the owner changes or clears the cache', async () => {
    const f = fixture(); let finish!: (value: unknown) => void;
    f.abortSignal.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const loader = createSupabaseForecastLoader('a', 6, async () => f.client);
    const waiting = expect(loader.load()).rejects.toThrow('Session changed');
    await vi.waitFor(() => expect(f.abortSignal).toHaveBeenCalled());
    loader.clear(); finish({ data: slice, error: null }); await waiting;
    expect(loader.getCached()).toBeNull();
    await expect(loader.load()).resolves.toEqual(slice);
    f.getSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(loader.load()).rejects.toThrow('Session changed');
  });
  it('preserves explicit nulls and rejects absent/invalid vintages', () => {
    expect(validateDatabaseArchive(archive, 6, revision)).toBe(archive);
    expect(validateDatabaseArchive(overview, 1, revision)).toBe(overview);
    for (const risks of [[0, 1, 2], [0, 1, 2, null, null, 4]]) {
      const broken = structuredClone(archive);
      broken.packedRiskByTargetMonth['2025-12']['300806'] = risks as typeof broken.packedRiskByTargetMonth['2025-12']['300806'];
      expect(() => validateDatabaseArchive(broken, 6, revision)).toThrow();
    }
  });
  it('loads only the requested month/scope and reuses parent data without another RPC', async () => {
    const f = fixture(); const loader = createSupabaseForecastLoader('a', 6, async () => f.client);
    await loader.load({ areaCode: '30', originPeriod: '2025-12' });
    expect(f.rpc).toHaveBeenCalledWith('ktp_load_forecast_slice', expect.objectContaining({ p_area_code: '30', p_origin_period: '2025-12' }));
    for (const areaCode of ['3008', '300806']) {
      const selected = await loader.load({ areaCode, originPeriod: '2025-12' });
      expect(selected).toEqual(forecastSlice(archive, { p_area_code: areaCode, p_origin_period: '2025-12' }));
      expect(Object.keys(selected.packedRiskByTargetMonth)).toEqual(['2025-12']);
    }
    expect(f.abortSignal).toHaveBeenCalledTimes(1);
    f.abortSignal.mockResolvedValue({ data: forecastSlice(archive, { p_area_code: '3008', p_origin_period: '2015-06' }), error: null });
    await loader.load({ areaCode: '3008', originPeriod: '2015-06' });
    expect(f.abortSignal).toHaveBeenCalledTimes(2);
  });
  it('checks Supabase before every cache reuse and replaces only the requested slice when a new dataset is published', async () => {
    const f = fixture(); const loader = createSupabaseForecastLoader('a', 6, async () => f.client);
    const query = { areaCode: '300806', originPeriod: '2025-12' };
    f.abortSignal.mockResolvedValue({ data: forecastSlice(archive, { p_area_code: query.areaCode }), error: null });
    await loader.load(query);
    await loader.load(query);
    expect(f.revisionSignal).toHaveBeenCalledTimes(2);
    expect(f.abortSignal).toHaveBeenCalledTimes(1);
    const updated = structuredClone(archive);
    updated.meta.datasetId = '11111111-1111-4111-8111-111111111111';
    updated.meta.datasetVersion = 'test-only-new-publication';
    updated.meta.sourceWorkbookSha256 = 'b'.repeat(64);
    updated.packedRiskByTargetMonth['2025-12']['300806'][0] = 2;
    f.revisionSignal.mockResolvedValue({ data: { ...forecastRevision(updated), publishedAt: '2026-09-07T10:00:00Z' }, error: null });
    f.abortSignal.mockResolvedValue({ data: forecastSlice(updated, { p_area_code: query.areaCode }), error: null });
    const fresh = await loader.load(query);
    expect(fresh.packedRiskByTargetMonth['2025-12']!['300806']![0]).toBe(2);
    expect(f.rpc).toHaveBeenLastCalledWith('ktp_load_forecast_slice', expect.objectContaining({ p_version: updated.meta.datasetVersion, p_area_code: '300806' }));
    expect(f.abortSignal).toHaveBeenCalledTimes(2);
    expect(loader.getCached({ areaCode: '30' })).toBeNull();
    f.revisionSignal.mockResolvedValue({ data: null, error: { message: 'offline' } });
    await expect(loader.load(query)).rejects.toThrow('Forecast revision unavailable');
  });
  it('accepts newly published source months without a frontend date-range update', async () => {
    const f = fixture(); const loader = createSupabaseForecastLoader('a', 6, async () => f.client);
    await loader.load();
    const updated = structuredClone(archive);
    updated.meta.datasetId = '11111111-1111-4111-8111-111111111111';
    updated.meta.datasetVersion = 'test-only-expanded-archive';
    updated.meta.sourceWorkbookSha256 = 'c'.repeat(64);
    updated.meta.targetMonthEnd = '2026-01';
    updated.meta.targetMonthCount++;
    updated.meta.forecastVintageCount += 289 * 6;
    const month = structuredClone(updated.targetMonths.at(-1)!);
    month.period = '2026-01'; month.labelTh = 'ม.ค. 2569';
    month.horizons.forEach(h => { h.issueMonth = month.period; h.targetMonth = forecastTargetPeriod(month.period, h.horizon); });
    updated.targetMonths.push(month);
    Object.assign(updated.packedRiskByTargetMonth, { '2026-01': updated.packedRiskByTargetMonth['2025-12'] });
    f.revisionSignal.mockResolvedValue({ data: { ...forecastRevision(updated), publishedAt: '2026-09-07T10:00:00Z' }, error: null });
    f.abortSignal.mockResolvedValue({ data: forecastSlice(updated), error: null });
    const fresh = await loader.load();
    expect(fresh.loadedSelection?.originPeriod).toBe('2026-01');
    expect(fresh.targetMonths).toHaveLength(128);
    expect(fresh.targetMonths.at(-1)?.horizons.at(-1)?.targetMonth).toBe('2026-07');
    expect(f.abortSignal).toHaveBeenCalledTimes(2);
  });
  it.each([2, 3])('rejects cleared requests even during session check %s', async (pausedCheck) => {
    const f = fixture(); let finish!: (value: unknown) => void;
    const owner = { data: { session: { user: { id: 'a' } } }, error: null };
    for (let check = 1; check < pausedCheck; check++) f.getSession.mockResolvedValueOnce(owner);
    f.getSession.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const loader = createSupabaseForecastLoader('a', 6, async () => f.client);
    const waiting = expect(loader.load()).rejects.toThrow('Session changed');
    await vi.waitFor(() => expect(finish).toBeDefined());
    loader.clear(); finish(owner); await waiting;
    expect(loader.getCached()).toBeNull();
  });
  it('does not let an older response overwrite a revision accepted during its final session check', async () => {
    const f = fixture(forecastSlice(archive, { p_area_code: '300806' }));
    const owner = { data: { session: { user: { id: 'a' } } }, error: null };
    let finish!: (value: unknown) => void;
    f.getSession.mockResolvedValueOnce(owner).mockResolvedValueOnce(owner)
      .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const loader = createSupabaseForecastLoader('a', 6, async () => f.client);
    const older = expect(loader.load({ areaCode: '300806' })).rejects.toThrow('Forecast revision changed');
    await vi.waitFor(() => expect(finish).toBeDefined());
    const updated = structuredClone(archive);
    updated.meta.datasetId = '11111111-1111-4111-8111-111111111111';
    updated.meta.datasetVersion = 'test-only-newer-response';
    updated.meta.sourceWorkbookSha256 = 'd'.repeat(64);
    f.revisionSignal.mockResolvedValue({ data: { ...forecastRevision(updated), publishedAt: '2026-09-07T10:00:00Z' }, error: null });
    f.abortSignal.mockResolvedValue({ data: forecastSlice(updated, { p_area_code: '300807' }), error: null });
    await loader.load({ areaCode: '300807' });
    finish(owner); await older;
    expect(loader.getCached({ areaCode: '300806' })).toBeNull();
    expect(loader.getCached({ areaCode: '300807' })?.meta.datasetId).toBe(updated.meta.datasetId);
  });
  it('validates scope completeness, dates, provenance and nulls without accepting an entire archive', () => {
    for (const areaCode of ['30', '3008', '300806']) {
      for (const data of [archive, overview]) {
        const query = { areaCode, originPeriod: '2025-12' };
        const selected = forecastSlice(data, { p_area_code: areaCode, p_origin_period: query.originPeriod });
        expect(validateDatabaseArchive(selected, data.meta.horizonCount as 1 | 6, revision, query)).toBe(selected);
        expect(selected.locations).toHaveLength(forecastScopeCodes(areaCode).length);
        for (const mutate of [
          (v: any) => { v.loadedSelection.originPeriod = '2025-11'; },
          (v: any) => { delete v.packedRiskByTargetMonth['2025-12'][v.locations[0].subdistrictCode]; },
          (v: any) => { v.meta.sourceWorkbookSha256 = 'wrong'; },
          (v: any) => { v.packedRiskByTargetMonth['2025-11'] = {}; },
          (v: any) => { v.packedRiskByTargetMonth['2025-12'][v.locations[0].subdistrictCode][0] = 4; },
        ]) {
          const invalid = structuredClone(selected); mutate(invalid);
          expect(() => validateDatabaseArchive(invalid, data.meta.horizonCount as 1 | 6, revision, query)).toThrow();
        }
      }
    }
    expect(() => validateDatabaseArchive(archive, 6, revision, { areaCode: '30' })).toThrow();
    expect(() => forecastScopeCodes('309999')).toThrow();
  });
});
