/** Resolve the displayed default Home forecast for bookmarks, export and search.
 * Explicit URLs remain authoritative; history state never supplies a missing
 * origin on another route or overrides a requested horizon.
 */
export function forecastLocationParams(location: Pick<Location, 'pathname' | 'search'>, historyState?: unknown) {
  const params = new URLSearchParams(location.search);
  const state = historyState && typeof historyState === 'object' ? historyState as Record<string, unknown> : {};
  const origin = state.ktpHomeForecastOrigin;
  if (location.pathname === '/' && !params.has('target') && !params.has('horizon')
    && typeof origin === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(origin)) {
    params.set('target', origin);
    params.set('horizon', '1');
  }
  return params;
}
