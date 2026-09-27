import { CmsError, requireCms } from './contract.mjs';
import { CMS_RESOURCE_BY_KEY } from '../../shared/cmsResources.mjs';
import { lockedResourceField } from '../../shared/resourceEditPolicy.mjs';

// Structural edits and key changes need a domain migration, not a generic form.
// Existing identities/provenance cannot be relabelled by editing a display field.
export function assertResourceEdit(original, next, path = '', lock = false) {
  if (lock) { requireCms(JSON.stringify(original) === JSON.stringify(next), 'resource_identity_locked'); return; }
  requireCms(next !== undefined, 'resource_shape_changed');
  if (original === null) { requireCms(next === null, 'resource_shape_changed'); return; }
  if (Array.isArray(original)) {
    requireCms(Array.isArray(next) && original.length === next.length, 'resource_shape_changed');
    original.forEach((item, index) => assertResourceEdit(item, next[index], `${path}/${index}`));
  } else if (typeof original === 'object') {
    requireCms(next && typeof next === 'object' && !Array.isArray(next)
      && Object.keys(original).length === Object.keys(next).length, 'resource_shape_changed');
    for (const key of Object.keys(original)) assertResourceEdit(original[key], next[key], `${path}/${key}`, lockedResourceField(key));
  } else {
    requireCms(typeof original === typeof next && (typeof next !== 'number' || Number.isFinite(next)), 'resource_shape_changed');
    if (typeof next === 'string' && /\/(url|href)$/i.test(path) && next) {
      let url;
      try { url = new URL(next); } catch { throw new CmsError(400, 'invalid_resource_url'); }
      requireCms(['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && !/\s/.test(next), 'invalid_resource_url');
    }
  }
}

export async function handleResourceAction(actor, action, body, operation) {
  requireCms(body && typeof body === 'object' && !Array.isArray(body));
  const allowed = action === 'clone' ? ['key'] : action === 'get' || action === 'history' ? ['id']
    : action === 'edit' ? ['id', 'revision', 'reason', 'payload'] : ['id', 'revision', 'reason'];
  requireCms(Object.keys(body).length === allowed.length && allowed.every(key => Object.hasOwn(body, key)));
  if (action === 'clone') requireCms(CMS_RESOURCE_BY_KEY.has(body.key), 'unknown_resource');
  else requireCms(typeof body.id === 'string' && /^[a-f0-9-]{36}$/i.test(body.id));
  if (['edit', 'publish'].includes(action)) {
    requireCms(Number.isInteger(body.revision) && body.revision > 0);
    requireCms(typeof body.reason === 'string' && body.reason.trim() && body.reason.length <= 1000, 'reason_required');
    const current = await operation(actor, 'resource:get', { id: body.id });
    if (current.revision !== body.revision) throw new CmsError(409, 'revision_conflict');
    if (action === 'edit') {
      requireCms(!['geometry', 'derived', 'retained'].includes(CMS_RESOURCE_BY_KEY.get(current.resource_key)?.group), 'resource_review_required');
      assertResourceEdit(current.payload, body.payload);
    }
  }
  return operation(actor, `resource:${action}`, body);
}
