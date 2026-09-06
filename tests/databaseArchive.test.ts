import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import archive from '../src/data/canonical/nakhon_ratchasima/drought_forecast_archive_rev03.json';
import overview from '../src/data/generated/forecast-overview-t1.json';
import { createSupabaseForecastLoader, validateDatabaseArchive } from '../src/data/supabaseForecastArchive';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
function fixture(data: unknown = archive) {
  const getSession = vi.fn().mockResolvedValue({ data: { session: { user: { id: 'a' } } }, error: null });
  const abortSignal = vi.fn().mockResolvedValue({ data, error: null });
  const rpc = vi.fn().mockReturnValue({ abortSignal });
  const client = { auth: { getSession }, rpc } as unknown as SupabaseClient;
  return { getSession, abortSignal, rpc, client };
}
describe('Supabase archive loader', () => {
  it('reuses pending requests and caches only in the current account provider', async () => {
    const f = fixture(); const loader = createSupabaseForecastLoader('a', 6, async () => f.client);
    const first = loader.load(); expect(loader.load()).toBe(first);
    expect(await first).toEqual(archive);
    await loader.load(); expect(f.rpc).toHaveBeenCalledTimes(1);
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
    await expect(loader.load()).resolves.toEqual(archive);
  });
  it('rejects a delayed response after the owner changes or clears the cache', async () => {
    const f = fixture(); let finish!: (value: unknown) => void;
    f.abortSignal.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const loader = createSupabaseForecastLoader('a', 6, async () => f.client);
    const waiting = expect(loader.load()).rejects.toThrow('Session changed');
    await vi.waitFor(() => expect(f.abortSignal).toHaveBeenCalled());
    loader.clear(); finish({ data: archive, error: null }); await waiting;
    expect(loader.getCached()).toBeNull();
    await expect(loader.load()).resolves.toEqual(archive);
    f.getSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(loader.load()).rejects.toThrow('Session changed');
  });
  it('preserves explicit nulls and rejects absent/invalid vintages', () => {
    expect(validateDatabaseArchive(archive, 6)).toBe(archive);
    expect(validateDatabaseArchive(overview, 1)).toBe(overview);
    for (const risks of [[0, 1, 2], [0, 1, 2, null, null, 4]]) {
      const broken = structuredClone(archive);
      broken.packedRiskByTargetMonth['2025-12']['300806'] = risks as typeof broken.packedRiskByTargetMonth['2025-12']['300806'];
      expect(() => validateDatabaseArchive(broken, 6)).toThrow();
    }
  });
});
