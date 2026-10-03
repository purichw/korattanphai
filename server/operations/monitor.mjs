import { withDeadline } from './http.mjs';

export function validateMonitorUrl(value) {
  const base = new URL(value);
  const local = ['localhost', '127.0.0.1'].includes(base.hostname);
  if (!(local && ['http:', 'https:'].includes(base.protocol) || base.origin === 'https://korattanphai.vercel.app') || base.username || base.password || base.search || base.hash || base.pathname !== '/') throw new Error('Use the exact production origin or localhost');
  return base;
}

export async function checkOperationalHealth({ url, healthToken, readiness = false, fetchImpl = fetch, timeoutMs = 10000 }) {
  const base = validateMonitorUrl(url);
  if (readiness && (typeof healthToken !== 'string' || healthToken.length < 32 || /[\r\n]/.test(healthToken))) throw new Error('Readiness requires OPERATIONAL_HEALTH_TOKEN');
  const checks = [];
  const probes = [
    { name: 'login_document', path: '/login', type: 'text/html', check: body => /<html[\s>]/i.test(body) && /<script[^>]+type=["']module["']/i.test(body) },
    { name: 'health_liveness', path: '/api/health', type: 'application/json', check: body => { const parsed = JSON.parse(body); return parsed.status === 'ok' && parsed.scope === 'process'; } },
    ...(readiness ? [{ name: 'published_archive_readiness', path: '/api/health?mode=readiness', type: 'application/json', token: healthToken, check: body => { const parsed = JSON.parse(body); return parsed.status === 'ready' && parsed.scope === 'published_archive' && parsed.checks?.publishedArchive === 'available'; } }] : []),
  ];
  for (const probe of probes) {
    const start = performance.now();
    try {
      await withDeadline(async signal => {
        const response = await fetchImpl(new URL(probe.path, base), { redirect: 'error', signal, headers: probe.token ? { Authorization: `Bearer ${probe.token}` } : undefined });
        if (response.status !== 200 || !(response.headers.get('content-type') ?? '').includes(probe.type)) throw new Error('Invalid response');
        const reader = response.body.getReader(); const chunks = []; let size = 0;
        try {
          while (true) {
            const { done, value } = await reader.read(); if (done) break;
            size += value.byteLength; if (size > 65536) throw new Error('Excessive response');
            chunks.push(Buffer.from(value));
          }
        } finally { await reader.cancel().catch(() => {}); }
        if (!probe.check(Buffer.concat(chunks).toString('utf8'))) throw new Error('Invalid response');
      }, timeoutMs);
      checks.push({ name: probe.name, status: 'passed', durationMs: Math.round(performance.now() - start) });
    } catch { checks.push({ name: probe.name, status: 'failed', durationMs: Math.round(performance.now() - start), code: 'probe_failed' }); }
  }
  return { schemaVersion: 1, checkedAt: new Date().toISOString(), target: base.origin, status: checks.every(check => check.status === 'passed') ? 'passed' : 'failed', scope: readiness ? 'web_api_and_archive' : 'web_and_api_only', checks };
}
