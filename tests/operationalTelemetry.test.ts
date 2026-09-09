import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createOperationalReporter, operationalRoute } from '../src/operationalTelemetry';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  window.history.replaceState(null, '', '/');
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe('privacy-safe operational reporting', () => {
  it('makes no requests when disabled, opted out, or performance sampling excludes the page', () => {
    createOperationalReporter({ enabled: false })({ event: 'runtime_error', code: 'RENDER_FAILED' });
    const report = createOperationalReporter({ enabled: true, sample: false });
    report({ event: 'web_vital', code: 'LCP', metric: 'LCP', value: 2500 });
    report({ event: 'map_load', code: 'LOAD_OK', durationMs: 200 });
    vi.stubGlobal('navigator', { doNotTrack: '1' });
    report({ event: 'runtime_error', code: 'RENDER_FAILED' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('projects only allowed fields and never sends credentials, raw errors, query strings or arbitrary identifiers', () => {
    window.history.replaceState(null, '', '/dan-khun-thot/t-300806?token=secret#private');
    const report = createOperationalReporter({ enabled: true, sample: true });
    report({ event: 'runtime_error', code: 'RENDER_FAILED', requestId: 'user@example.test',
      message: 'user@example.test secret', stack: '/private/path', password: 'secret' } as never);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('/api/telemetry');
    expect(JSON.parse(init!.body as string)).toEqual({ schemaVersion: 1, event: 'runtime_error', code: 'RENDER_FAILED', route: 'subdistrict', viewport: 'desktop' });
    expect(init).toMatchObject({ credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', mode: 'same-origin' });
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it('rejects arbitrary event/code pairs and clamps numeric measurements', () => {
    const report = createOperationalReporter({ enabled: true, sample: true });
    report({ event: 'map_load', code: 'user@example.test' } as never);
    report({ event: 'web_vital', code: 'CLS', metric: 'LCP', value: 2000 });
    report({ event: 'web_vital', code: 'LCP', metric: 'LCP', value: NaN });
    expect(fetch).not.toHaveBeenCalled();
    report({ event: 'map_load', code: 'LOAD_OK', durationMs: 900_000.23 });
    report({ event: 'web_vital', code: 'CLS', metric: 'CLS', value: 0.02343 });
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string).durationMs).toBe(600_000);
    expect(JSON.parse(vi.mocked(fetch).mock.calls[1][1]!.body as string).value).toBe(0.023);
  });

  it('deduplicates repeated errors, limits concurrent sends, and never retries a failed collector', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.mocked(fetch).mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init!.signal!.addEventListener('abort', () => reject(new Error('collector unavailable')));
    }));
    const report = createOperationalReporter({ enabled: true, sample: true });
    for (let i = 0; i < 100; i++) report({ event: 'runtime_error', code: 'RENDER_FAILED' });
    for (const path of ['/login', '/drought', '/dan-khun-thot', '/other/path']) {
      window.history.replaceState(null, '', path);
      report({ event: 'map_load', code: 'LOAD_FAILED' });
    }
    expect(fetchMock).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('caps the total page budget even when every request succeeds', async () => {
    const report = createOperationalReporter({ enabled: true, sample: true });
    for (const path of ['/', '/login', '/drought', '/dan-khun-thot', '/dan-khun-thot/t-300806', '/other/path']) {
      window.history.replaceState(null, '', path);
      for (const code of ['LOAD_OK', 'LOAD_FAILED', 'LOAD_TIMEOUT'] as const) {
        report({ event: 'map_load', code });
        await Promise.resolve(); await Promise.resolve();
        report({ event: 'forecast_load', code });
        await Promise.resolve(); await Promise.resolve();
      }
    }
    expect(fetch).toHaveBeenCalledTimes(20);
  });

  it('reduces arbitrary locations to known route categories', () => {
    expect(operationalRoute('/dan-khun-thot/t-300806?email=secret')).toBe('subdistrict');
    expect(operationalRoute('/private/user@example.test')).toBe('other');
    expect(operationalRoute('/login?next=/private')).toBe('login');
  });

  it('sends a coarse viewport class without dimensions or a user agent', () => {
    vi.stubGlobal('innerWidth', 390);
    const report = createOperationalReporter({ enabled: true });
    report({ event: 'runtime_error', code: 'RENDER_FAILED' });
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    expect(body.viewport).toBe('mobile');
    expect(Object.keys(body).sort()).toEqual(['code', 'event', 'route', 'schemaVersion', 'viewport']);
  });
});
