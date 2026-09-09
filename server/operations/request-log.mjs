import { randomUUID } from 'node:crypto';

const LABEL = /^[a-z][a-z0-9_-]{0,63}$/;
const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

// Log an allowlist only. Request URLs, query strings, payloads, IP addresses,
// credentials and exception messages must never enter an operational event.
export function beginRequest(request, response, { route, log = console.info, now = Date.now } = {}) {
  if (typeof route !== 'string' || !/^\/api\/[a-z0-9/-]{1,80}$/.test(route)) throw new Error('A static API route is required.');
  const requestId = randomUUID();
  const startedAt = now();
  response.setHeader('X-Request-ID', requestId);
  let finished = false;
  return {
    requestId,
    finish({ status = response.statusCode, code, clientId } = {}) {
      if (finished) return;
      finished = true;
      const elapsed = now() - startedAt;
      const entry = {
        timestamp: new Date(startedAt).toISOString(),
        event: 'api_request_completed',
        requestId,
        route,
        method: METHODS.has(request?.method) ? request.method : 'OTHER',
        status: Number.isInteger(status) && status >= 100 && status <= 599 ? status : 500,
        durationMs: Number.isFinite(elapsed) ? Math.max(0, Math.round(elapsed)) : 0,
        ...(typeof code === 'string' && LABEL.test(code) ? { code } : {}),
        ...(typeof clientId === 'string' && LABEL.test(clientId) ? { clientId } : {}),
      };
      // A log transport outage must not change a successfully stored receipt.
      try { log(JSON.stringify(entry)); } catch { /* Request outcome is already decided. */ }
    },
  };
}
