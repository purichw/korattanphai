import { createTelemetryHandler } from '../server/operations/telemetry.mjs';
import { createSupabaseRateLimiter } from '../server/operations/rate-limit.mjs';
import { sendJson } from '../server/operations/http.mjs';

export default async function handler(request, response) {
  try {
    const enabled = process.env.OPERATIONAL_TELEMETRY_ENABLED === 'true';
    const limiter = enabled ? createSupabaseRateLimiter({
      url: process.env.OPERATIONAL_SUPABASE_URL,
      key: process.env.OPERATIONAL_SUPABASE_SECRET_KEY,
      requestsPerMinute: 1000,
      dailyQuota: 50000,
    }) : undefined;
    return createTelemetryHandler({
      enabled,
      origins: enabled ? (process.env.OPERATIONAL_TELEMETRY_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean) : [],
      limiter,
    })(request, response);
  } catch { sendJson(response, 503, { error: { code: 'telemetry_unavailable' } }); }
}
