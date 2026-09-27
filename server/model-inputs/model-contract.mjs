import { validateBatch, hashBatch, InputError, normalizeTimestamp, SOURCE_ID, BATCH_ID } from './contract.mjs';
import { isKoratSubdistrict } from './domain-contract.mjs';
import { requiredFields } from '../../shared/dataFields.mjs';

export const FEATURE_METRICS = ['precipitation', 'ndvi', 'ndmi', 'land_surface_temperature', 'soil_moisture'];
const assert = (condition, message) => { if (!condition) throw new InputError(message); };
const monthPattern = /^(19\d\d|20\d\d|2100)-(0[1-9]|1[0-2])$/;

export function shiftMonth(month, offset) {
  assert(typeof month === 'string' && monthPattern.test(month), 'A Gregorian YYYY-MM month is required.');
  const [year, number] = month.split('-').map(Number);
  return new Date(Date.UTC(year, number - 1 + offset, 1)).toISOString().slice(0, 7);
}

function scopeCodes(codes) {
  assert(Array.isArray(codes) && codes.length > 0 && codes.length <= 289
    && codes.every(isKoratSubdistrict) && new Set(codes).size === codes.length, 'Scope requires unique canonical Korat subdistrict codes.');
  return [...codes].sort();
}

/** A deterministic handoff to the team's model, not a forecasting algorithm. */
export function prepareModelRequest({ batches, originMonth, informationCutoff, subdistrictCodes, historyMonths = 36, minimumValidPixelFraction = 0.5, requiredMetrics = ['precipitation', 'ndvi', 'land_surface_temperature'] }) {
  const codes = scopeCodes(subdistrictCodes);
  shiftMonth(originMonth, 0);
  assert(Number.isInteger(historyMonths) && historyMonths >= 1 && historyMonths <= 120, 'historyMonths must be 1–120.');
  assert(Number.isFinite(minimumValidPixelFraction) && minimumValidPixelFraction >= 0 && minimumValidPixelFraction <= 1, 'minimumValidPixelFraction must be 0–1.');
  assert(Array.isArray(requiredMetrics) && requiredMetrics.length > 0 && requiredMetrics.every((metric) => FEATURE_METRICS.includes(metric))
    && new Set(requiredMetrics).size === requiredMetrics.length, 'requiredMetrics must name unique supported metrics.');
  const cutoff = normalizeTimestamp(informationCutoff);
  assert(cutoff >= `${shiftMonth(originMonth, 1)}-01T00:00:00.000Z`, 'The completed-month example requires a cutoff after the end of originMonth.');
  assert(Array.isArray(batches) && batches.length > 0 && batches.length <= 100, 'Supply 1–100 input batches.');
  const startMonth = shiftMonth(originMonth, 1 - historyMonths);
  const cells = new Map(), crops = new Map(), references = new Map();
  const excluded = { afterCutoff: 0, outsideScopeOrWindow: 0 };
  for (const incoming of batches) {
    const { contentHash, receivedAt: _receivedAt, ...envelope } = incoming;
    const batch = validateBatch(envelope);
    assert(['satellite', 'crop'].includes(batch.kind), 'This model handoff accepts satellite and crop batches.');
    const hash = hashBatch(batch);
    assert(contentHash === undefined || contentHash === hash, 'Input contentHash does not match the canonical batch.');
    const refKey = `${batch.sourceId}/${batch.batchId}`;
    const previous = references.get(refKey);
    assert(!previous || previous.contentHash === hash, 'Conflicting input batch versions.');
    if (previous) continue;
    references.set(refKey, { sourceId: batch.sourceId, batchId: batch.batchId, contentHash: hash });
    for (const row of batch.observations) {
      if (row.availableAt > cutoff) { excluded.afterCutoff++; continue; }
      if (!codes.includes(row.subdistrictCode)) { excluded.outsideScopeOrWindow++; continue; }
      if (batch.kind === 'satellite') {
        if (row.period < startMonth || row.period > originMonth) { excluded.outsideScopeOrWindow++; continue; }
        const key = `${row.subdistrictCode}/${row.period}/${row.metric}`;
        assert(!cells.has(key), 'Overlapping satellite versions must be reconciled explicitly before model input.');
        cells.set(key, { ...row, sourceId: batch.sourceId, batchId: batch.batchId });
      } else {
        if (row.periodEnd.slice(0, 7) > originMonth) { excluded.outsideScopeOrWindow++; continue; }
        const key = `${row.subdistrictCode}/${row.cropCode}/${row.seasonId}`;
        assert(!crops.has(key), 'Overlapping crop outcome versions must be reconciled explicitly before model input.');
        crops.set(key, { ...row, sourceId: batch.sourceId, batchId: batch.batchId });
      }
    }
  }
  const monthlyFeatures = [];
  for (const code of codes) for (let offset = 1 - historyMonths; offset <= 0; offset++) {
    const period = shiftMonth(originMonth, offset);
    const features = {}, missingOrUnusableMetrics = [];
    for (const metric of FEATURE_METRICS) {
      const reading = cells.get(`${code}/${period}/${metric}`) ?? null;
      features[metric] = reading;
      if (requiredMetrics.includes(metric) && (!reading || reading.value === null || reading.quality !== 'reported' || reading.validPixelFraction < minimumValidPixelFraction)) missingOrUnusableMetrics.push(metric);
    }
    monthlyFeatures.push({ subdistrictCode: code, period, features, missingOrUnusableMetrics });
  }
  return {
    schemaVersion: 1, featureSchema: 'satellite-crop-v1-draft', originMonth, informationCutoff: cutoff,
    scope: { subdistrictCodes: codes }, horizons: [1, 2, 3, 4, 5, 6],
    assumptions: { historyMonths, minimumValidPixelFraction, requiredMetrics: [...requiredMetrics] },
    inputBatches: [...references.values()], monthlyFeatures, historicalCropOutcomes: [...crops.values()], excluded,
    completeFeatureMonths: monthlyFeatures.filter((row) => row.missingOrUnusableMetrics.length === 0).length,
  };
}

const exactKeys = (object, keys) => object && typeof object === 'object' && !Array.isArray(object)
  && Object.keys(object).length === keys.length && keys.every((key) => Object.hasOwn(object, key));

/** Validates a model-team result before a separate, reviewed publication step. */
export function validateForecastResult(result) {
  assert(exactKeys(result, ['schemaVersion', 'runId', 'modelVersion', 'originMonth', 'informationCutoff', 'createdAt', 'scope', 'inputBatches', 'predictions']), 'Invalid model result envelope.');
  assert(result.schemaVersion === 1 && typeof result.runId === 'string' && BATCH_ID.test(result.runId), 'Invalid model result schemaVersion/runId.');
  assert(typeof result.modelVersion === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(result.modelVersion), 'An explicit modelVersion is required.');
  shiftMonth(result.originMonth, 0);
  const informationCutoff = normalizeTimestamp(result.informationCutoff);
  const createdAt = normalizeTimestamp(result.createdAt);
  assert(informationCutoff >= `${shiftMonth(result.originMonth, 1)}-01T00:00:00.000Z` && createdAt >= informationCutoff, 'Invalid model information cutoff/creation time.');
  assert(exactKeys(result.scope, ['subdistrictCodes']), 'Invalid result scope.');
  const codes = scopeCodes(result.scope.subdistrictCodes);
  assert(Array.isArray(result.inputBatches) && result.inputBatches.length > 0 && result.inputBatches.length <= 100, 'Input batch provenance is required.');
  const references = new Set();
  for (const ref of result.inputBatches) {
    assert(exactKeys(ref, ['sourceId', 'batchId', 'contentHash']) && typeof ref.sourceId === 'string' && SOURCE_ID.test(ref.sourceId)
      && typeof ref.batchId === 'string' && BATCH_ID.test(ref.batchId) && typeof ref.contentHash === 'string' && /^[a-f0-9]{64}$/.test(ref.contentHash), 'Invalid input batch provenance.');
    const key = `${ref.sourceId}/${ref.batchId}`;
    assert(!references.has(key), 'Duplicate input batch provenance.'); references.add(key);
  }
  validateForecastCells(result.predictions, { codes, originMonth: result.originMonth });
  return { ...result, informationCutoff, createdAt, scope: { subdistrictCodes: codes } };
}

export function validateForecastCells(predictions, { codes, originMonth }) {
  assert(Array.isArray(predictions) && predictions.length === codes.length * 6, 'Return all T+1 through T+6 cells for every scoped subdistrict.');
  const seen = new Set();
  for (const [index, row] of predictions.entries()) {
    try {
    assert(exactKeys(row, requiredFields('forecast')), 'Invalid prediction row.');
    assert(codes.includes(row.subdistrictCode) && Number.isInteger(row.horizonMonths) && row.horizonMonths >= 1 && row.horizonMonths <= 6, 'Prediction is outside its area/horizon scope.');
    assert(row.targetMonth === shiftMonth(originMonth, row.horizonMonths), 'targetMonth must equal originMonth + horizonMonths.');
    assert(['predicted', 'out_of_scope', 'insufficient_data'].includes(row.status), 'Invalid prediction status.');
    assert(row.status === 'predicted' ? [0, 1, 2].includes(row.riskCode) : row.riskCode === null, 'Predicted risk must be 0/1/2; other statuses require null.');
    const key = `${row.subdistrictCode}/${row.horizonMonths}`;
    assert(!seen.has(key), 'Duplicate prediction cell.'); seen.add(key);
    } catch (error) { throw new InputError(`Prediction ${index + 1}: ${error.message}`); }
  }
  return predictions;
}

export function forecastCellsForReview(input) {
  const result = validateForecastResult(input);
  return result.predictions.map((row) => ({
    sourceMonth: result.originMonth, subdistrictCode: row.subdistrictCode,
    horizonMonths: row.horizonMonths, targetMonth: row.targetMonth,
    risk: row.riskCode, status: row.status,
  }));
}
