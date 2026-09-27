import { createClient } from '@supabase/supabase-js';
import { withDeadline } from '../operations/http.mjs';
import { CmsError } from './contract.mjs';
import { createCmsHandler } from './handler.mjs';

export function configuredCmsHandler(env = process.env) {
  const url = env.CMS_SUPABASE_URL;
  const key = env.CMS_SUPABASE_SECRET_KEY;
  if (!url || !/^https:\/\/[^/]+\/?$/.test(url) || !key || key.startsWith('sb_publishable_')) {
    throw new CmsError(503, 'cms_not_configured');
  }
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  return createCmsHandler({
    async authenticate(token) {
      const { data, error } = await withDeadline(() => client.auth.getUser(token), 5000);
      if (error || !data.user) throw new CmsError(401, 'sign_in_required');
      return data.user.id;
    },
    async operation(actor, operation, args) {
      const forecast = operation.startsWith('forecast:');
      const resource = operation.startsWith('resource:');
      const { data, error } = await withDeadline(signal => client.rpc(resource ? 'ktp_cms_resource_operation' : forecast ? 'ktp_cms_forecast' : 'ktp_cms_operation', {
        p_actor: actor, p_operation: resource ? operation.slice(9) : forecast ? operation.slice('forecast:'.length) : operation, p_args: args,
      }).abortSignal(signal), forecast && operation.endsWith('publish') ? 60000 : 15000);
      if (error) {
        if (error.code === '42501') throw new CmsError(403, 'cms_forbidden');
        if (error.code === '40001') throw new CmsError(409, 'revision_conflict');
        if (error.code === '23505') throw new CmsError(409, 'batch_already_exists');
        if (error.code === 'P0002') throw new CmsError(404, 'draft_not_found');
        if (error.code === '55000') throw new CmsError(409, 'immutable_revision');
        throw new CmsError(503, 'cms_unavailable');
      }
      return data;
    },
  });
}
