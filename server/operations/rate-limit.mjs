import { createHash } from 'node:crypto';

const ID = /^[a-z][a-z0-9_-]{0,63}$/;
const MAX_RESPONSE_BYTES = 4096;

function unavailable() {
  const error = new Error('Request quota service is unavailable.');
  error.code = 'rate_limit_unavailable';
  error.status = 503;
  return error;
}

export function rateLimitOptionsFromEnvironment(env = process.env) {
  function integer(name, fallback, maximum) {
    const raw = env[name];
    if (raw === undefined || raw === '') return fallback;
    if (typeof raw !== 'string' || !/^[1-9]\d{0,7}$/.test(raw) || Number(raw) > maximum) throw new Error(`Invalid ${name}.`);
    return Number(raw);
  }
  return {
    requestsPerMinute: integer('MODEL_INPUT_RATE_LIMIT_PER_MINUTE', 60, 60000),
    dailyQuota: integer('MODEL_INPUT_DAILY_QUOTA', 10000, 10000000),
  };
}

function settings(requestsPerMinute, dailyQuota) {
  if (!Number.isInteger(requestsPerMinute) || requestsPerMinute < 1 || requestsPerMinute > 60000
    || !Number.isInteger(dailyQuota) || dailyQuota < 1 || dailyQuota > 10000000) throw new Error('Invalid request quota limits.');
}

function scopeKey({ sourceId, clientId }) {
  if (typeof sourceId !== 'string' || !ID.test(sourceId) || typeof clientId !== 'string' || !ID.test(clientId)) throw unavailable();
  return createHash('sha256').update(`model-inputs:v1:${sourceId}:${clientId}`).digest('hex');
}

// Deterministic local development/test adapter only. It is process-local, resets
// on restart, and MUST NOT be used by a deployed serverless entrypoint.
export function createMemoryRateLimiter({ requestsPerMinute = 60, dailyQuota = 10000, now = Date.now } = {}) {
  settings(requestsPerMinute, dailyQuota);
  const scopes = new Map();
  return {
    requestsPerMinute,
    dailyQuota,
    async consume(identity) {
      const key = scopeKey(identity);
      const seconds = Math.floor(now() / 1000);
      const minute = Math.floor(seconds / 60) * 60;
      const day = Math.floor(seconds / 86400) * 86400;
      const previous = scopes.get(key);
      const entry = {
        minute,
        day,
        minuteCount: previous?.minute === minute ? previous.minuteCount : 0,
        dayCount: previous?.day === day ? previous.dayCount : 0,
      };
      const allowed = entry.minuteCount < requestsPerMinute && entry.dayCount < dailyQuota;
      const retryAfterSeconds = Math.max(
        entry.minuteCount >= requestsPerMinute ? minute + 60 - seconds : 0,
        entry.dayCount >= dailyQuota ? day + 86400 - seconds : 0,
      );
      if (allowed) { entry.minuteCount++; entry.dayCount++; }
      scopes.set(key, entry);
      return { allowed, retryAfterSeconds, remainingMinute: Math.max(0, requestsPerMinute - entry.minuteCount), remainingDaily: Math.max(0, dailyQuota - entry.dayCount) };
    },
  };
}

// The database clock and a row lock enforce the same quota across all instances.
// No unbounded provider response, raw upstream error, or fallback to memory.
export function createSupabaseRateLimiter({ url, key, requestsPerMinute = 60, dailyQuota = 10000, fetchImpl = globalThis.fetch, timeoutMs = 5000 } = {}) {
  settings(requestsPerMinute, dailyQuota);
  let target;
  try {
    const origin = new URL(url);
    if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash
      || typeof key !== 'string' || key.length < 1 || key.length > 8192 || /[\r\n]/.test(key)
      || typeof fetchImpl !== 'function' || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) throw unavailable();
    target = new URL('/rest/v1/rpc/consume_model_input_quota', origin);
  } catch { throw unavailable(); }
  return {
    requestsPerMinute,
    dailyQuota,
    async consume(identity) {
      const hash = scopeKey(identity);
      const controller = new AbortController();
      let timer;
      try {
        const operation = (async () => {
          const response = await fetchImpl(target.href, {
            method: 'POST', redirect: 'error', signal: controller.signal,
            headers: { apikey: key, ...(key.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${key}` }), Accept: 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({ p_scope_key: hash, p_minute_limit: requestsPerMinute, p_daily_limit: dailyQuota }),
          });
          if (response.redirected || !response.ok || !response.headers.get('content-type')?.toLowerCase().includes('application/json')) {
            await response.body?.cancel(); throw unavailable();
          }
          const length = response.headers.get('content-length');
          if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_RESPONSE_BYTES)) { await response.body?.cancel(); throw unavailable(); }
          if (!response.body) throw unavailable();
          const reader = response.body.getReader();
          let size = 0; const chunks = [];
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > MAX_RESPONSE_BYTES) { await reader.cancel(); throw unavailable(); }
            chunks.push(value);
          }
          const rows = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, size)));
          const row = Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
          if (!row || typeof row.allowed !== 'boolean'
            || !Number.isInteger(row.retry_after_seconds) || row.retry_after_seconds < 0 || row.retry_after_seconds > 86400
            || !Number.isInteger(row.remaining_minute) || row.remaining_minute < 0 || row.remaining_minute > requestsPerMinute
            || !Number.isInteger(row.remaining_daily) || row.remaining_daily < 0 || row.remaining_daily > dailyQuota
            || row.allowed && row.retry_after_seconds !== 0 || !row.allowed && row.retry_after_seconds === 0) throw unavailable();
          return { allowed: row.allowed, retryAfterSeconds: row.retry_after_seconds, remainingMinute: row.remaining_minute, remainingDaily: row.remaining_daily };
        })();
        return await Promise.race([operation, new Promise((_, reject) => {
          timer = setTimeout(() => { controller.abort(); reject(unavailable()); }, timeoutMs);
        })]);
      } catch { controller.abort(); throw unavailable(); }
      finally { clearTimeout(timer); }
    },
  };
}
