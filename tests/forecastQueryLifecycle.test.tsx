import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { useForecastArchive } from '../src/useForecastArchive';

const services = vi.hoisted(() => ({
  full: { getCached: vi.fn(() => null), load: vi.fn() },
  overview: { getCached: vi.fn(() => null), load: vi.fn() },
}));
vi.mock('../src/DatabaseWorkspaceProvider', () => ({ useDatabaseWorkspace: () => services }));

afterEach(() => { cleanup(); vi.clearAllMocks(); window.history.replaceState({}, '', '/'); });

it('reads the new route URL instead of carrying a previous month across Home, district and tambon navigation', async () => {
  services.full.load.mockResolvedValue(null);
  window.history.replaceState({}, '', '/drought?target=2025-12');
  const { result, rerender } = renderHook(({ enabled, area }) => useForecastArchive(enabled, 'full', area), {
    initialProps: { enabled: true, area: '30' },
  });
  await waitFor(() => expect(result.current.pending).toBe(false));
  act(() => result.current.requestPeriod!('2025-11'));
  await waitFor(() => expect(services.full.load).toHaveBeenLastCalledWith({ areaCode: '30', originPeriod: '2025-11' }));

  window.history.replaceState({}, '', '/');
  rerender({ enabled: false, area: '30' });
  window.history.replaceState({}, '', '/dan-khun-thot?target=2015-06');
  rerender({ enabled: true, area: '3008' });
  await waitFor(() => expect(result.current.pending).toBe(false));
  expect(services.full.load).toHaveBeenLastCalledWith({ areaCode: '3008', originPeriod: '2015-06' });

  window.history.replaceState({}, '', '/dan-khun-thot/t-300806?target=2025-10');
  rerender({ enabled: true, area: '300806' });
  await waitFor(() => expect(result.current.pending).toBe(false));
  expect(services.full.load).toHaveBeenLastCalledWith({ areaCode: '300806', originPeriod: '2025-10' });

  window.history.replaceState({}, '', '/drought');
  rerender({ enabled: true, area: '30' });
  await waitFor(() => expect(result.current.pending).toBe(false));
  expect(services.full.load.mock.calls.map(([query]) => query)).toEqual([
    { areaCode: '30', originPeriod: '2025-12' },
    { areaCode: '30', originPeriod: '2025-11' },
    { areaCode: '3008', originPeriod: '2015-06' },
    { areaCode: '300806', originPeriod: '2025-10' },
    { areaCode: '30', originPeriod: null },
  ]);
});

it('does not show a disabled route loader failure in another view', async () => {
  services.full.load.mockRejectedValue(new Error('test offline'));
  window.history.replaceState({}, '', '/drought');
  const { result, rerender } = renderHook(({ enabled }) => useForecastArchive(enabled), { initialProps: { enabled: true } });
  await waitFor(() => expect(result.current.failed).toBe(true));
  window.history.replaceState({}, '', '/');
  rerender({ enabled: false });
  expect(result.current.failed).toBe(false);
  expect(result.current.pending).toBe(false);
});
