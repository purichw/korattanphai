import { createArchiveProbe, createHealthHandler } from '../server/operations/health.mjs';

export default async function handler(request, response) {
  let probe;
  try {
    probe = createArchiveProbe({ url: process.env.OPERATIONAL_SUPABASE_URL, key: process.env.OPERATIONAL_SUPABASE_SECRET_KEY });
  } catch { /* Liveness stays available; readiness fails closed without configuration. */ }
  return createHealthHandler({ token: process.env.OPERATIONAL_HEALTH_TOKEN, probe })(request, response);
}
