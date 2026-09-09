import { beginRequest } from './request-log.mjs';
import { OperationalError, readSmallJson, sendJson } from './http.mjs';

const routes = new Set(['login', 'overview', 'province', 'district', 'subdistrict', 'other']);
const codes = {
  runtime_error: ['RENDER_FAILED', 'UNHANDLED_ERROR', 'UNHANDLED_REJECTION'],
  resource_error: ['RESOURCE_FAILED'],
  forecast_load: ['LOAD_OK', 'LOAD_FAILED', 'LOAD_TIMEOUT'],
  map_load: ['LOAD_OK', 'LOAD_FAILED', 'LOAD_TIMEOUT'],
  web_vital: ['LCP', 'INP', 'CLS'],
};
const fields = new Set(['schemaVersion', 'event', 'code', 'route', 'viewport', 'durationMs', 'metric', 'value', 'requestId']);

export function validateTelemetry(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !fields.has(key)) || value.schemaVersion !== 1 || typeof value.event !== 'string' || !Object.hasOwn(codes, value.event) || !codes[value.event].includes(value.code) || !routes.has(value.route) || !['mobile', 'desktop'].includes(value.viewport)) throw new OperationalError(400, 'invalid_event');
  if (Object.hasOwn(value, 'durationMs') && (!Number.isInteger(value.durationMs) || value.durationMs < 0 || value.durationMs > 600000)) throw new OperationalError(400, 'invalid_event');
  if (Object.hasOwn(value, 'requestId') && (typeof value.requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.requestId))) throw new OperationalError(400, 'invalid_event');
  if (value.event === 'web_vital') {
    if (value.metric !== value.code || typeof value.value !== 'number' || !Number.isFinite(value.value) || value.value < 0 || value.value > (value.metric === 'CLS' ? 100 : 600000) || Object.hasOwn(value, 'durationMs')) throw new OperationalError(400, 'invalid_event');
  } else if (Object.hasOwn(value, 'metric') || Object.hasOwn(value, 'value')) throw new OperationalError(400, 'invalid_event');
  return { ...value };
}

export function createTelemetryHandler({ enabled = false, origins = [], limiter, log = console.info } = {}) {
  const allowed = new Set(origins.map(value => {
    const url = new URL(value);
    if (url.origin !== value || url.username || url.password || !(url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) throw new Error('Invalid telemetry origin');
    return url.origin;
  }));
  return async (request, response) => {
    const trace = beginRequest(request, response, { route: '/api/telemetry', log: enabled ? log : () => {} });
    let status = 204, code = 'accepted';
    try {
      if (request.method !== 'POST') { response.setHeader('Allow', 'POST'); throw new OperationalError(405, 'method_not_allowed'); }
      if (new URL(request.url, 'http://local').search) throw new OperationalError(400, 'invalid_query');
      if (!enabled) { code = 'disabled'; return sendJson(response, 204); }
      if (!allowed.size || !limiter) throw new OperationalError(503, 'not_configured');
      if (!allowed.has(request.headers.origin) || (request.headers['sec-fetch-site'] && request.headers['sec-fetch-site'] !== 'same-origin')) throw new OperationalError(403, 'origin_not_allowed');
      const event = validateTelemetry(await readSmallJson(request, 1024));
      const quota = await limiter.consume({ sourceId: 'operational-telemetry', clientId: 'browser' });
      if (!quota.allowed) { response.setHeader('Retry-After', String(quota.retryAfterSeconds)); throw new OperationalError(429, 'rate_limited'); }
      // Fixed schema only. Platform access logs have a separate retention/privacy policy.
      try { log(JSON.stringify({ category: 'browser_operational_event', receivedAt: new Date().toISOString(), ...event })); } catch { /* Monitoring must not break the response. */ }
      sendJson(response, 204);
    } catch (error) {
      status = error instanceof OperationalError ? error.status : 503;
      code = error instanceof OperationalError ? error.code : 'telemetry_unavailable';
      sendJson(response, status, { error: { code } });
    } finally { trace.finish({ status, code }); }
  };
}
