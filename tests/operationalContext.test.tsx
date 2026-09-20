import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useOperationalContext } from '../src/useOperationalContext';
import { BUSINESS_TIMEZONE, OPERATIONAL_POLICY_VERSION, businessMonth, nextBusinessMonth, operationalFamily, sourceAvailability } from '../src/data/operationalPolicy.mjs';

function response(period: string, now = '2026-09-30T16:59:58Z') {
  return { ok: true, json: async () => ({ policyVersion: OPERATIONAL_POLICY_VERSION, timezone: BUSINESS_TIMEZONE,
    serverNow: now, currentPeriod: businessMonth(now), validPeriod: period, nextBoundary: nextBusinessMonth(now),
    family: operationalFamily(period, now), sourceAvailability, actualPeriods: [], forecastPeriods: [], latestActualPeriod: null }) } as Response;
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it('hides an old period immediately and ignores its late response', async () => {
  let completeOld!: (value: Response) => void;
  const fetcher = vi.fn().mockImplementationOnce(() => new Promise(resolve => { completeOld = resolve; }))
    .mockResolvedValue(response('2026-10'));
  vi.stubGlobal('fetch', fetcher);
  const { result, rerender } = renderHook(({ period }) => useOperationalContext('30', period), { initialProps: { period: '2026-08' } });
  rerender({ period: '2026-10' });
  expect(result.current.snapshot).toBeUndefined();
  await waitFor(() => expect(result.current.snapshot?.family).toBe('forecast'));
  await act(async () => completeOld(response('2026-08')));
  expect(result.current.snapshot?.validPeriod).toBe('2026-10');
  expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
  expect(fetcher.mock.calls[1][1].cache).toBe('no-store');
});
it('re-resolves the same explicit month after server boundary on focus', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(response('2026-10')).mockResolvedValue(response('2026-10', '2026-09-30T17:00:01Z'));
  vi.stubGlobal('fetch', fetcher);
  const { result } = renderHook(() => useOperationalContext('30', '2026-10'));
  await waitFor(() => expect(result.current.snapshot?.family).toBe('forecast'));
  act(() => window.dispatchEvent(new Event('focus')));
  await waitFor(() => expect(result.current.snapshot?.family).toBe('actual'));
  expect(result.current.snapshot?.partialPeriod).toBe(true);
});
it('keeps network failure separate from confirmed unavailable and retries without fallback', async () => {
  const fetcher = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(response('2026-08'));
  vi.stubGlobal('fetch', fetcher);
  const { result } = renderHook(() => useOperationalContext('3001', '2026-08'));
  await waitFor(() => expect(result.current.status).toBe('error'));
  expect(result.current.snapshot).toBeUndefined();
  act(() => result.current.retry());
  await waitFor(() => expect(result.current.snapshot?.availability).toBe('unavailable'));
  expect(result.current.snapshot?.forecastRecords).toEqual([]);
});
