import { timingSafeEqual } from 'node:crypto';
import { beginRequest } from './request-log.mjs';
import { OperationalError, sendJson, withDeadline } from './http.mjs';

export function createArchiveProbe({ url, key, fetchImpl = fetch, timeoutMs = 5000 }) {
  const base = new URL(url);
  if (base.protocol !== 'https:' || !/^[a-z0-9]+\.supabase\.co$/.test(base.hostname) || base.port || base.username || base.password || base.search || base.hash || base.pathname !== '/') throw new Error('Invalid operational database configuration');
  if (typeof key !== 'string' || key.length < 20 || /[\r\n]/.test(key)) throw new Error('Invalid operational database configuration');
  return () => withDeadline(async (signal) => {
    const target = new URL('/rest/v1/ktp_forecast_datasets', base);
    target.searchParams.set('select', 'dataset_id,published_at,source_time_role');
    target.searchParams.set('status', 'eq.published');
    target.searchParams.set('source_time_role', 'eq.CONFIRMED_SOURCE_IS_ORIGIN');
    target.searchParams.set('archive_manifest->meta->>sourceOfTruth', 'eq.normalized_rev03_original_workbook');
    target.searchParams.set('order', 'published_at.desc,dataset_id.desc');
    target.searchParams.set('limit', '1');
    const headers = { apikey: key, Accept: 'application/json' };
    if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
    const response = await fetchImpl(target, { headers, signal, redirect: 'error' });
    if (!response.ok || !/application\/json/i.test(response.headers.get('content-type') ?? '')) throw new OperationalError(503, 'archive_unavailable');
    const reader = response.body.getReader();
    const chunks = []; let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 4096) throw new OperationalError(503, 'archive_unavailable');
        chunks.push(Buffer.from(value));
      }
    } finally { await reader.cancel().catch(() => {}); }
    const rows = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!Array.isArray(rows) || rows.length !== 1 || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rows[0]?.dataset_id ?? '') || typeof rows[0]?.published_at !== 'string' || !Number.isFinite(Date.parse(rows[0].published_at)) || rows[0]?.source_time_role !== 'CONFIRMED_SOURCE_IS_ORIGIN') throw new OperationalError(503, 'archive_unavailable');
    return { publishedArchive: 'available' };
  }, timeoutMs);
}

export function createHealthHandler({ token, probe, log = console.info } = {}) {
  return async (request, response) => {
    const trace = beginRequest(request, response, { route: '/api/health', log });
    let status = 200, code = 'ok';
    try {
      if (request.method !== 'GET') { response.setHeader('Allow', 'GET'); throw new OperationalError(405, 'method_not_allowed'); }
      const query = new URL(request.url, 'http://local').searchParams;
      if ([...query.keys()].some(key => key !== 'mode') || query.getAll('mode').length > 1) throw new OperationalError(400, 'invalid_query');
      const mode = query.get('mode') ?? 'liveness';
      if (mode === 'liveness') return sendJson(response, 200, { status: 'ok', scope: 'process' });
      if (mode !== 'readiness') throw new OperationalError(400, 'invalid_query');
      if (typeof token !== 'string' || token.length < 32 || /[\r\n]/.test(token) || !probe) throw new OperationalError(503, 'not_configured');
      const expected = Buffer.from(`Bearer ${token}`), supplied = Buffer.from(request.headers.authorization ?? '');
      if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) throw new OperationalError(401, 'unauthorized');
      await probe();
      sendJson(response, 200, { status: 'ready', scope: 'published_archive', checks: { publishedArchive: 'available' } });
    } catch (error) {
      status = error instanceof OperationalError ? error.status : 503;
      code = error instanceof OperationalError ? error.code : 'dependency_unavailable';
      sendJson(response, status, { status: 'unavailable', code });
    } finally { trace.finish({ status, code }); }
  };
}
