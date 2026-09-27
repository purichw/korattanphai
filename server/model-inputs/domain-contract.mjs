import { readFileSync } from 'node:fs';
import { requiredFields, optionalFields } from '../../shared/dataFields.mjs';

const matrix = JSON.parse(readFileSync(new URL('../../src/data/canonical/nakhon_ratchasima/district_subdistrict_matrix.json', import.meta.url), 'utf8'));
const subdistricts = new Set(matrix.map(row => row.subdistrict_code));
if (subdistricts.size !== 289 || matrix.length !== 289 || matrix.some(row => row.province_code !== '30'
  || row.province_id !== 'TH-P29' || !/^30\d{4}$/.test(row.subdistrict_code))) {
  throw new Error('Canonical Korat administrative code matrix is invalid.');
}

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/;
const CROP_MEASURES = ['plantedAreaRai', 'harvestedAreaRai', 'productionTonnes', 'yieldKgPerRai'];
const METRICS = {
  ndvi: { unit: '1', minimum: -1, maximum: 1, aggregation: 'mean' },
  ndmi: { unit: '1', minimum: -1, maximum: 1, aggregation: 'mean' },
  land_surface_temperature: { unit: 'degC', aggregation: 'mean' },
  precipitation: { unit: 'mm', minimum: 0, aggregation: 'sum' },
  soil_moisture: { unit: 'm3/m3', minimum: 0, maximum: 1, aggregation: 'mean' },
};

export function isKoratSubdistrict(code) {
  return typeof code === 'string' && subdistricts.has(code);
}

// The HTTP contract owns envelope/size checks and supplies its existing strict
// timestamp/error helpers. Injection keeps the two validators free of cycles.
export function validateDomainBatch(input, { normalizeTimestamp, InputError } = {}) {
  if (typeof normalizeTimestamp !== 'function' || typeof InputError !== 'function') {
    throw new TypeError('Domain validation requires timestamp and error helpers.');
  }
  const assert = (condition, message) => { if (!condition) throw new InputError(message, 400, 'invalid_batch'); };
  assert(input && ['satellite', 'crop'].includes(input.kind), 'Batch kind must be satellite or crop.');
  assert(Array.isArray(input.observations) && input.observations.length > 0, 'observations must be a nonempty array.');
  const fields = requiredFields(input.kind);
  const allowedOptional = optionalFields(input.kind);

  function finite(value) { return typeof value === 'number' && Number.isFinite(value); }
  function asciiText(value, label) {
    assert(typeof value === 'string' && value.length <= 128 && /^[\x20-\x7e]+$/.test(value) && value.trim().length > 0,
      `${label} must be nonempty printable ASCII text of at most 128 characters.`);
    return value.trim();
  }
  function calendarDay(value, label) {
    assert(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value), `${label} must be a Gregorian date (YYYY-MM-DD).`);
    const [year, month, day] = value.split('-').map(Number);
    const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
    assert(year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= days,
      `${label} has an invalid Gregorian date (1900–2100).`);
    return Date.UTC(year, month - 1, day);
  }
  function availability(value, earliest, label) {
    let normalized;
    try { normalized = normalizeTimestamp(value); }
    catch { throw new InputError(`${label}: availableAt must be a valid ISO timestamp with seconds and an explicit UTC offset.`, 400, 'invalid_batch'); }
    assert(Date.parse(normalized) >= earliest, `${label}: availableAt cannot precede the end of the observation period.`);
    return normalized;
  }

  const seen = new Set();
  const observations = input.observations.map((row, index) => {
    const label = `Observation ${index + 1}`;
    assert(row !== null && typeof row === 'object' && !Array.isArray(row), `${label} must be an object.`);
    assert(fields.every(field => Object.hasOwn(row, field)), `${label} is missing a required field.`);
    assert(Object.keys(row).every(field => fields.includes(field) || allowedOptional.includes(field)), `${label} has an unknown field.`);
    assert(isKoratSubdistrict(row.subdistrictCode), `${label}: subdistrictCode must be a canonical Nakhon Ratchasima subdistrict code.`);
    assert(['reported', 'missing', 'suspect'].includes(row.quality), `${label}: invalid quality.`);
    if (Object.hasOwn(row, 'sourceRecordId')) {
      assert(typeof row.sourceRecordId === 'string' && row.sourceRecordId.length > 0 && row.sourceRecordId.length <= 128
        && !/[\u0000-\u001f\u007f]/.test(row.sourceRecordId), `${label}: sourceRecordId must be nonempty text of at most 128 characters.`);
    }
    let normalized;
    let identity;
    if (input.kind === 'satellite') {
      assert(typeof row.period === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(row.period), `${label}: period must be YYYY-MM.`);
      const [year, month] = row.period.split('-').map(Number);
      assert(year >= 1900 && year <= 2100, `${label}: period must use a Gregorian year between 1900 and 2100.`);
      const availableAt = availability(row.availableAt, Date.UTC(year, month, 1), label);
      assert(typeof row.metric === 'string' && Object.hasOwn(METRICS, row.metric), `${label}: unsupported satellite metric.`);
      const metric = METRICS[row.metric];
      assert(row.unit === metric.unit, `${label}: unit does not match the satellite metric; convert explicitly before submission.`);
      assert(row.temporalAggregation === metric.aggregation, `${label}: precipitation requires monthly sum; other satellite metrics require monthly mean.`);
      assert(['area_weighted_mean', 'coarse_grid_proxy'].includes(row.spatialAggregation), `${label}: invalid spatialAggregation.`);
      assert(row.value === null || finite(row.value), `${label}: value must be finite or null.`);
      assert(row.value === null ? row.quality === 'missing' : row.quality !== 'missing', `${label}: value is null exactly when quality is missing.`);
      if (row.value !== null) {
        assert(metric.minimum === undefined || row.value >= metric.minimum, `${label}: value is below the supported metric range.`);
        assert(metric.maximum === undefined || row.value <= metric.maximum, `${label}: value is above the supported metric range.`);
      }
      assert(finite(row.validPixelFraction) && row.validPixelFraction >= 0 && row.validPixelFraction <= 1,
        `${label}: validPixelFraction must be between 0 and 1.`);
      assert(row.value === null || row.validPixelFraction > 0, `${label}: a reported value requires valid pixels.`);
      assert(finite(row.resolutionMeters) && row.resolutionMeters > 0, `${label}: resolutionMeters must be positive and finite.`);
      const product = asciiText(row.product, `${label}: product`);
      const productVersion = asciiText(row.productVersion, `${label}: productVersion`);
      const processingVersion = asciiText(row.processingVersion, `${label}: processingVersion`);
      const provenance = {};
      for (const name of ['geometryVersion', 'maskVersion']) {
        if (Object.hasOwn(row, name)) provenance[name] = asciiText(row[name], `${label}: ${name}`);
      }
      if (Object.hasOwn(row, 'nativeSupportMeters')) {
        assert(finite(row.nativeSupportMeters) && row.nativeSupportMeters > 0, `${label}: nativeSupportMeters must be positive and finite.`);
        provenance.nativeSupportMeters = row.nativeSupportMeters;
      }
      if (Object.hasOwn(row, 'sourceArtifactHash')) {
        assert(typeof row.sourceArtifactHash === 'string' && /^[A-Fa-f0-9]{64}$/.test(row.sourceArtifactHash), `${label}: sourceArtifactHash must be a 64-character SHA-256 hexadecimal digest.`);
        provenance.sourceArtifactHash = row.sourceArtifactHash.toLowerCase();
      }
      normalized = { subdistrictCode: row.subdistrictCode, period: row.period, availableAt, metric: row.metric,
        value: row.value, unit: row.unit, quality: row.quality, validPixelFraction: row.validPixelFraction,
        product, productVersion, processingVersion, resolutionMeters: row.resolutionMeters,
        spatialAggregation: row.spatialAggregation, temporalAggregation: row.temporalAggregation, ...provenance };
      identity = [row.subdistrictCode, row.period, row.metric, product, productVersion];
    } else {
      assert(typeof row.cropCode === 'string' && IDENTIFIER.test(row.cropCode), `${label}: cropCode must be an ASCII identifier (1–64 characters).`);
      assert(typeof row.seasonId === 'string' && IDENTIFIER.test(row.seasonId), `${label}: seasonId must be an ASCII identifier (1–64 characters).`);
      assert(['calendar_year', 'crop_season'].includes(row.periodType), `${label}: periodType must be calendar_year or crop_season.`);
      const start = calendarDay(row.periodStart, `${label}: periodStart`);
      const end = calendarDay(row.periodEnd, `${label}: periodEnd`);
      assert(start <= end, `${label}: periodStart cannot follow periodEnd.`);
      if (row.periodType === 'calendar_year') {
        assert(row.periodStart.slice(0, 4) === row.periodEnd.slice(0, 4)
          && row.periodStart.endsWith('-01-01') && row.periodEnd.endsWith('-12-31'),
        `${label}: calendar_year requires January 1 through December 31 of the same Gregorian year.`);
      }
      const availableAt = availability(row.availableAt, end + 86_400_000, label);
      assert(row.agency === 'DOAE', `${label}: agency must be DOAE.`);
      const datasetVersion = asciiText(row.datasetVersion, `${label}: datasetVersion`);
      for (const measure of CROP_MEASURES) {
        assert(row[measure] === null || finite(row[measure]) && row[measure] >= 0,
          `${label}: ${measure} must be a nonnegative finite number or null.`);
      }
      const missing = CROP_MEASURES.every(measure => row[measure] === null);
      assert(missing ? row.quality === 'missing' : row.quality !== 'missing', `${label}: quality is missing exactly when all crop measures are null.`);
      assert(['harvested', 'planted', 'unspecified'].includes(row.yieldAreaBasis), `${label}: yieldAreaBasis must be harvested, planted, or unspecified.`);
      normalized = { subdistrictCode: row.subdistrictCode, cropCode: row.cropCode, seasonId: row.seasonId,
        periodType: row.periodType, periodStart: row.periodStart, periodEnd: row.periodEnd, availableAt, agency: 'DOAE', datasetVersion,
        plantedAreaRai: row.plantedAreaRai, harvestedAreaRai: row.harvestedAreaRai,
        productionTonnes: row.productionTonnes, yieldKgPerRai: row.yieldKgPerRai, yieldAreaBasis: row.yieldAreaBasis, quality: row.quality };
      identity = [row.subdistrictCode, row.cropCode, row.seasonId, datasetVersion];
    }
    const key = JSON.stringify(identity);
    assert(!seen.has(key), `${label}: duplicate ${input.kind} observation identity in this batch.`);
    seen.add(key);
    return { ...normalized, ...(row.sourceRecordId === undefined ? {} : { sourceRecordId: row.sourceRecordId }) };
  });
  return { schemaVersion: 1, sourceId: input.sourceId, batchId: input.batchId, kind: input.kind, observations };
}
