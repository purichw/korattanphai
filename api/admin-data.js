import { configuredCmsHandler } from '../server/admin-data/supabase.mjs';
import { sendJson } from '../server/operations/http.mjs';

let handler;
export default async function adminData(request, response) {
  try { handler ??= configuredCmsHandler(); }
  catch { return sendJson(response, 503, { error: { code: 'cms_not_configured' } }); }
  return handler(request, response);
}
