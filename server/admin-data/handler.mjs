import { readSmallJson, sendJson } from '../operations/http.mjs';
import { DATA_FIELDS } from '../../shared/dataFields.mjs';
import { handleResourceAction } from './resources.mjs';
import { CMS_BODY_LIMIT, CmsError, requireCms, checkDraft, checkEditablePayload, contentHash,
  inspectCmsPayload, validateCmsPayload } from './contract.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const readActions = new Set(['list', 'get', 'original', 'audit', 'schema', 'forecast-catalog', 'forecast-crosswalk', 'resource-catalog']);
const writeActions = new Set(['create', 'edit', 'validate', 'accept', 'clone-forecast', 'forecast-source', 'resource-get', 'resource-clone', 'resource-edit', 'resource-publish', 'resource-history']);

export function createCmsHandler({ authenticate, operation }) {
  return async (request, response) => {
    try {
      if (!['GET', 'POST'].includes(request.method)) {
        response.setHeader('Allow', 'GET, POST'); throw new CmsError(405, 'method_not_allowed');
      }
      const token = /^Bearer ([^\s]{1,8192})$/.exec(request.headers.authorization ?? '')?.[1];
      if (!token) throw new CmsError(401, 'sign_in_required');
      // Session verification is remote, not JWT decoding or client-supplied roles.
      const actor = await authenticate(token);
      if (!actor || !UUID.test(actor)) throw new CmsError(401, 'sign_in_required');
      await operation(actor, 'access', {});
      const url = new URL(request.url, 'https://admin.invalid');
      const query = url.searchParams;
      requireCms([...query.keys()].every(key => ['action', 'id', 'offset'].includes(key))
        && [...new Set(query.keys())].every(key => query.getAll(key).length === 1));
      const action = query.get('action') ?? 'list';
      requireCms((request.method === 'GET' ? readActions : writeActions).has(action));
      const id = query.get('id');
      if (id !== null) requireCms(UUID.test(id), 'invalid_id');
      if (['get', 'original', 'audit', 'edit', 'validate', 'accept'].includes(action)) requireCms(id, 'missing_id');
      if (!['get', 'original', 'audit', 'edit', 'validate', 'accept'].includes(action)) requireCms(id === null);
      if (action !== 'list') requireCms(!query.has('offset'));
      if (action === 'schema') return sendJson(response, 200, { schemaVersion: 1, fields: DATA_FIELDS, rowLimit: 2000 });
      if (action === 'forecast-catalog') return sendJson(response, 200, await operation(actor, 'forecast:catalog', {}));
      if (action === 'forecast-crosswalk') return sendJson(response, 200, await operation(actor, 'forecast:crosswalk', {}));
      if (action === 'resource-catalog') return sendJson(response, 200, await operation(actor, 'resource:catalog', {}));
      if (action === 'list') {
        const offset = query.get('offset') ?? '0';
        requireCms(/^\d{1,6}$/.test(offset) && Number(offset) <= 100000);
        return sendJson(response, 200, await operation(actor, 'list', { offset: Number(offset) }));
      }
      if (request.method === 'GET') return sendJson(response, 200, await operation(actor, action, { id }));
      if (request.headers['sec-fetch-site'] && request.headers['sec-fetch-site'] !== 'same-origin') {
        throw new CmsError(403, 'cross_origin_denied');
      }
      const body = await readSmallJson(request, CMS_BODY_LIMIT, 10000);
      if (action.startsWith('resource-')) return sendJson(response, 200, await handleResourceAction(actor, action.slice(9), body, operation));
      if (action === 'clone-forecast' || action === 'forecast-source') {
        requireCms(body && typeof body === 'object' && Object.keys(body).length === 2 && UUID.test(body.datasetId)
          && /^\d{4}-(0[1-9]|1[0-2])$/.test(body.originMonth));
        const payload = await operation(actor, 'forecast:read', body);
        if (action === 'forecast-source') return sendJson(response, 200, payload);
        const draft = checkDraft({ kind: 'archive', title: `พยากรณ์ ${body.originMonth}`, payload, sourceFilename: 'published-database' });
        return sendJson(response, 201, await operation(actor, 'create', { ...draft, originalHash: contentHash(payload) }));
      }
      if (action === 'create') {
        const draft = checkDraft(body);
        return sendJson(response, 201, await operation(actor, 'create', { ...draft, originalHash: contentHash(draft.payload) }));
      }
      requireCms(body && typeof body === 'object' && !Array.isArray(body));
      requireCms(Object.keys(body).every(key => (action === 'edit' ? ['revision', 'reason', 'payload']
        : action === 'accept' ? ['revision', 'reason'] : ['revision']).includes(key)));
      requireCms(Number.isInteger(body.revision) && body.revision > 0, 'invalid_revision');
      const draft = await operation(actor, 'get', { id });
      if (draft.revision !== body.revision) throw new CmsError(409, 'revision_conflict');
      if (action === 'validate') return sendJson(response, 200, { revision: draft.revision, ...inspectCmsPayload(draft.kind, draft.payload) });
      requireCms(typeof body.reason === 'string' && body.reason.trim().length > 0 && body.reason.length <= 1000, 'reason_required');
      if (action === 'edit') {
        checkEditablePayload(draft.kind, body.payload);
        if (draft.kind === 'archive') requireCms(['schemaVersion', 'baseDatasetId', 'originMonth', 'scope', 'sourceImport'].every(key =>
          JSON.stringify(body.payload[key]) === JSON.stringify(draft.payload[key])), 'archive_scope_locked');
        return sendJson(response, 200, await operation(actor, action, { id, ...body }));
      }
      // Model result validation is not permission to publish a public forecast.
      if (draft.kind === 'forecast') throw new CmsError(409, 'forecast_publication_not_enabled');
      let canonical;
      try { canonical = validateCmsPayload(draft.kind, draft.payload); }
      catch { return sendJson(response, 422, { error: { code: 'validation_failed' }, ...inspectCmsPayload(draft.kind, draft.payload) }); }
      return sendJson(response, 200, await operation(actor, draft.kind === 'archive' ? 'forecast:publish' : 'accept', {
        id, revision: body.revision, reason: body.reason, payload: canonical, contentHash: contentHash(canonical),
      }));
    } catch (error) {
      const safe = error instanceof CmsError || Number.isInteger(error.status) && typeof error.code === 'string';
      sendJson(response, safe ? error.status : 503, { error: { code: safe ? error.code : 'cms_unavailable' } });
    }
  };
}
