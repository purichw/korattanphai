import { createHash } from 'node:crypto';
import { validateBatch, MAX_BODY_BYTES } from '../model-inputs/contract.mjs';
import { validateForecastResult, validateForecastCells, shiftMonth } from '../model-inputs/model-contract.mjs';
import { isKoratSubdistrict } from '../model-inputs/domain-contract.mjs';
import { DATA_FIELDS } from '../../shared/dataFields.mjs';

export const CMS_BODY_LIMIT = 2 * 1024 * 1024;
export class CmsError extends Error {
  constructor(status, code, message = code) { super(message); this.status = status; this.code = code; }
}
export const requireCms = (condition, code = 'invalid_request') => {
  if (!condition) throw new CmsError(400, code);
};
export const contentHash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function checkDraft(input) {
  requireCms(input && typeof input === 'object' && !Array.isArray(input));
  requireCms(Object.keys(input).every(key => ['kind', 'title', 'payload', 'sourceFilename'].includes(key)));
  requireCms(Object.hasOwn(DATA_FIELDS, input.kind), 'unsupported_kind');
  requireCms(typeof input.title === 'string' && input.title.trim().length > 0 && input.title.length <= 160, 'invalid_title');
  requireCms(typeof input.sourceFilename === 'string' && input.sourceFilename.length <= 240
    && !/[\u0000-\u001f\u007f]/.test(input.sourceFilename), 'invalid_source_filename');
  checkEditablePayload(input.kind, input.payload);
  return { ...input, title: input.title.trim() };
}

// Staging deliberately accepts invalid field values so staff can repair them.
// Domain validation is mandatory again at acceptance, never a browser verdict.
export function checkEditablePayload(kind, payload) {
  requireCms(Object.hasOwn(DATA_FIELDS, kind), 'unsupported_kind');
  requireCms(payload && typeof payload === 'object' && !Array.isArray(payload), 'invalid_payload');
  const rows = payload[['forecast', 'archive'].includes(kind) ? 'predictions' : 'observations'];
  requireCms(Array.isArray(rows) && rows.length > 0 && rows.length <= 2000, 'row_limit');
  requireCms(rows.every(row => row && typeof row === 'object' && !Array.isArray(row)), 'invalid_row');
  requireCms(Buffer.byteLength(JSON.stringify(payload)) <= CMS_BODY_LIMIT - 8192, 'payload_too_large');
}

export function validateCmsPayload(kind, payload) {
  checkEditablePayload(kind, payload);
  if (kind === 'forecast') return validateForecastResult(payload);
  if (kind === 'archive') {
    requireCms(Object.keys(payload).every(key => ['schemaVersion', 'baseDatasetId', 'originMonth', 'scope', 'predictions', 'sourceImport'].includes(key))
      && ['schemaVersion', 'baseDatasetId', 'originMonth', 'scope', 'predictions'].every(key => Object.hasOwn(payload, key)), 'invalid_archive_envelope');
    if (payload.sourceImport !== undefined) {
      const source = payload.sourceImport;
      requireCms(source && typeof source === 'object' && Object.keys(source).length === 3 && /^[a-f0-9]{64}$/.test(source.sha256)
        && typeof source.sheet === 'string' && source.sheet.length <= 100 && Array.isArray(source.rows) && source.rows.length <= 2000
        && source.rows.every(row => Number.isInteger(row.sourceRow) && row.sourceRow >= 2 && row.values && typeof row.values === 'object'), 'invalid_import_evidence');
    }
    requireCms(payload.schemaVersion === 1 && /^[a-f0-9-]{36}$/.test(payload.baseDatasetId), 'invalid_archive_envelope');
    shiftMonth(payload.originMonth, 0);
    const codes = payload.scope?.subdistrictCodes;
    requireCms(payload.scope && Object.keys(payload.scope).length === 1 && Array.isArray(codes) && codes.length === 289
      && new Set(codes).size === 289 && codes.every(isKoratSubdistrict), 'incomplete_archive_scope');
    validateForecastCells(payload.predictions, { codes, originMonth: payload.originMonth });
    requireCms(payload.predictions.every(row => row.status !== 'insufficient_data'), 'archive_cannot_relabel_insufficient_data');
    return payload;
  }
  requireCms(kind === 'station' ? payload.kind === undefined : payload.kind === kind, 'kind_mismatch');
  requireCms(Buffer.byteLength(JSON.stringify(payload)) <= MAX_BODY_BYTES, 'api_batch_too_large');
  return validateBatch(payload);
}

export function inspectCmsPayload(kind, payload) {
  checkEditablePayload(kind, payload);
  const issues = [];
  const rowKey = ['forecast', 'archive'].includes(kind) ? 'predictions' : 'observations';
  if (!['forecast', 'archive'].includes(kind)) {
    payload[rowKey].forEach((row, index) => {
      try { validateCmsPayload(kind, { ...payload, [rowKey]: [row] }); }
      catch (error) { issues.push({ row: index + 1, message: error.message }); }
    });
  }
  try {
    const canonical = validateCmsPayload(kind, payload);
    return { valid: true, issues: [], rowCount: payload[rowKey].length, contentHash: contentHash(canonical) };
  } catch (error) {
    // The complete validator also catches duplicate identities and incomplete T+.
    if (!issues.length) issues.push({ row: /^Prediction (\d+):/.exec(error.message)?.[1]
      ? Number(/^Prediction (\d+):/.exec(error.message)[1]) : null, message: error.message });
    return { valid: false, issues, rowCount: payload[rowKey].length, contentHash: null };
  }
}
