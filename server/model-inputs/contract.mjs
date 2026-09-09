import { createHash } from 'node:crypto';
import { validateDomainBatch } from './domain-contract.mjs';

export const MAX_BODY_BYTES = 1024 * 1024;
export const MAX_OBSERVATIONS = 2000;
export const SOURCE_ID = /^[a-z][a-z0-9_-]{0,63}$/;
export const BATCH_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const STATION_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/;
const UNITS = {
  rainfall: 'mm', air_temperature: 'degC', relative_humidity: '%',
  water_level: 'm', streamflow: 'm3/s', soil_moisture: '%',
};

export class InputError extends Error {
  constructor(message, status = 400, code = 'invalid_batch') {
    super(message);
    this.name = 'InputError';
    this.status = status;
    this.code = code;
  }
}

function assert(condition, message, status = 400) {
  if (!condition) throw new InputError(message, status);
}

function objectWithKeys(value, required, optional, label) {
  assert(value !== null && typeof value === 'object' && !Array.isArray(value), `${label} must be an object.`);
  assert(required.every((key) => Object.hasOwn(value, key)), `${label} is missing a required field.`);
  assert(Object.keys(value).every((key) => required.includes(key) || optional.includes(key)), `${label} has an unknown field.`);
}

// Date.parse alone accepts dates such as February 30 by rolling into March.
// Require an explicit offset and validate the source calendar before normalization.
export function normalizeTimestamp(value) {
  assert(typeof value === 'string', 'observedAt must be an ISO timestamp with an explicit offset.');
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  assert(match, 'observedAt must be an ISO timestamp with seconds and an explicit offset.');
  const [, ys, ms, ds, hs, mins, ss, , offset] = match;
  const [year, month, day, hour, minute, second] = [ys, ms, ds, hs, mins, ss].map(Number);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  assert(year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= days
    && hour <= 23 && minute <= 59 && second <= 59, 'observedAt has an invalid Gregorian date or time (1900–2100).');
  if (offset !== 'Z') {
    const hours = Number(offset.slice(1, 3));
    const minutes = Number(offset.slice(4));
    assert(hours <= 14 && minutes <= 59 && (hours !== 14 || minutes === 0), 'observedAt has an invalid UTC offset.');
  }
  const timestamp = Date.parse(value);
  assert(Number.isFinite(timestamp), 'observedAt is invalid.');
  return new Date(timestamp).toISOString();
}

// PostgreSQL preserves microseconds; never truncate a pagination boundary.
export function validateReceivedAt(value) {
  assert(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value), 'Invalid receipt timestamp.');
  normalizeTimestamp(value.replace(/(\.\d{3})\d+/, '$1'));
  return value;
}

export function validateBatch(input) {
  objectWithKeys(input, ['schemaVersion', 'sourceId', 'batchId', 'observations'], ['kind'], 'Batch');
  assert(input.schemaVersion === 1, 'schemaVersion must be 1.');
  assert(typeof input.sourceId === 'string' && SOURCE_ID.test(input.sourceId), 'sourceId must be a lowercase ASCII identifier (1–64 characters).');
  assert(typeof input.batchId === 'string' && BATCH_ID.test(input.batchId), 'batchId must be an ASCII identifier (1–128 characters).');
  assert(Array.isArray(input.observations) && input.observations.length > 0, 'observations must be a nonempty array.');
  assert(input.observations.length <= MAX_OBSERVATIONS, `At most ${MAX_OBSERVATIONS} observations are accepted per batch.`, 413);
  if (input.kind !== undefined) {
    assert(['satellite', 'crop'].includes(input.kind), 'kind must be satellite or crop; omit for station observations.');
    return validateDomainBatch(input, { normalizeTimestamp, InputError });
  }
  const seen = new Set();
  const observations = input.observations.map((row, index) => {
    const label = `Observation ${index + 1}`;
    objectWithKeys(row, ['stationId', 'observedAt', 'metric', 'value', 'unit', 'aggregation', 'periodMinutes', 'quality'], ['sourceRecordId'], label);
    assert(typeof row.stationId === 'string' && STATION_ID.test(row.stationId), `${label}: stationId must be an ASCII identifier (1–64 characters).`);
    const observedAt = normalizeTimestamp(row.observedAt);
    assert(typeof row.metric === 'string' && Object.hasOwn(UNITS, row.metric), `${label}: unsupported metric.`);
    assert(row.unit === UNITS[row.metric], `${label}: unit does not match the metric; convert explicitly before submission.`);
    assert(['instant', 'sum', 'mean', 'min', 'max'].includes(row.aggregation), `${label}: invalid aggregation.`);
    assert(Number.isInteger(row.periodMinutes) && row.periodMinutes >= 0 && row.periodMinutes <= 527040, `${label}: periodMinutes must be an integer between 0 and 527040.`);
    assert(row.aggregation === 'instant' ? row.periodMinutes === 0 : row.periodMinutes > 0, `${label}: instant uses periodMinutes 0; aggregates require a positive period.`);
    assert(row.metric === 'rainfall' ? row.aggregation === 'sum' : row.aggregation !== 'sum', `${label}: rainfall requires sum; other metrics use instant, mean, min or max.`);
    assert(['reported', 'missing', 'suspect'].includes(row.quality), `${label}: invalid quality.`);
    assert(row.value === null ? row.quality === 'missing' : row.quality !== 'missing', `${label}: value is null exactly when quality is missing.`);
    assert(row.value === null || (typeof row.value === 'number' && Number.isFinite(row.value)), `${label}: value must be a finite number or null.`);
    if (row.value !== null) {
      assert(['air_temperature', 'water_level'].includes(row.metric) || row.value >= 0, `${label}: this metric cannot be negative.`);
      assert(!['relative_humidity', 'soil_moisture'].includes(row.metric) || row.value <= 100, `${label}: percentage cannot exceed 100.`);
    }
    if (Object.hasOwn(row, 'sourceRecordId')) {
      assert(typeof row.sourceRecordId === 'string' && row.sourceRecordId.length > 0 && row.sourceRecordId.length <= 128
        && !/[\u0000-\u001f\u007f]/.test(row.sourceRecordId), `${label}: sourceRecordId must be nonempty text of at most 128 characters.`);
    }
    const identity = JSON.stringify([row.stationId, observedAt, row.metric, row.aggregation, row.periodMinutes]);
    assert(!seen.has(identity), `${label}: duplicate station/time/metric/period in this batch.`);
    seen.add(identity);
    return {
      stationId: row.stationId, observedAt, metric: row.metric, value: row.value,
      unit: row.unit, aggregation: row.aggregation, periodMinutes: row.periodMinutes, quality: row.quality,
      ...(row.sourceRecordId === undefined ? {} : { sourceRecordId: row.sourceRecordId }),
    };
  });
  return { schemaVersion: 1, sourceId: input.sourceId, batchId: input.batchId, observations };
}

export function hashBatch(batch) {
  return createHash('sha256').update(JSON.stringify(batch)).digest('hex');
}

export function batchMetadata(batch) {
  return {
    sourceId: batch.sourceId, batchId: batch.batchId, contentHash: batch.contentHash,
    receivedAt: batch.receivedAt, observationCount: batch.observations.length,
  };
}
