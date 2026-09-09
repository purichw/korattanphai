import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { validateBatch, hashBatch, validateReceivedAt, MAX_BODY_BYTES, MAX_OBSERVATIONS } from './contract.mjs';
import { parseRetryAfter } from './job-files.mjs';

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_CONFIG_BYTES = 64 * 1024;
const DOMAIN_FIELDS = {
  satellite: ['subdistrictCode', 'period', 'availableAt', 'metric', 'value', 'unit', 'quality', 'validPixelFraction', 'product', 'productVersion', 'processingVersion', 'resolutionMeters', 'spatialAggregation', 'temporalAggregation'],
  crop: ['subdistrictCode', 'cropCode', 'seasonId', 'periodType', 'periodStart', 'periodEnd', 'availableAt', 'agency', 'datasetVersion', 'plantedAreaRai', 'harvestedAreaRai', 'productionTonnes', 'yieldKgPerRai', 'yieldAreaBasis', 'quality'],
};
const SATELLITE_OPTIONAL_FIELDS = ['geometryVersion', 'maskVersion', 'nativeSupportMeters', 'sourceArtifactHash'];
const DOMAIN_NUMERIC_FIELDS = new Set(['value', 'validPixelFraction', 'resolutionMeters', 'nativeSupportMeters', 'plantedAreaRai', 'harvestedAreaRai', 'productionTonnes', 'yieldKgPerRai']);
const safeOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const fail = (message) => { throw new Error(message); };

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
}

function keys(value, allowed, label) {
  object(value, label);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`Unknown ${label} field: ${key}`);
}

function column(value, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > 128) fail(`${label} must be a column name`);
}

function checkedUrl(value, { allowHttp = false, upload = false } = {}) {
  let url;
  try { url = new URL(value); } catch { fail('A valid absolute HTTP URL is required'); }
  if (url.username || url.password || url.hash) fail('URLs must not contain credentials or fragments');
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && (upload ? loopback : allowHttp))) {
    fail(upload ? 'Submission requires HTTPS (HTTP is allowed only on loopback)' : 'HTTP sources require explicit source.allowHttp: true');
  }
  return url;
}

export function validateCollectorConfig(config) {
  object(config, 'config');
  const domain = config.kind !== undefined;
  if (domain && !safeOwn(DOMAIN_FIELDS, config.kind)) fail('Collector kind must be satellite or crop');
  keys(config, domain
    ? ['schemaVersion', 'kind', 'sourceId', 'source', 'format', 'fields', 'constants', 'missingValues']
    : ['schemaVersion', 'sourceId', 'source', 'format', 'fields', 'timestamp', 'missingValues', 'measurements'], 'config');
  if (config.schemaVersion !== 1) fail('Collector config schemaVersion must be 1');
  if (typeof config.sourceId !== 'string' || !/^[a-z][a-z0-9_-]{0,63}$/.test(config.sourceId)) fail('Invalid config sourceId');
  keys(config.source, ['type', 'path', 'url', 'allowHttp', 'headers', 'timeoutMs'], 'source');
  if (config.source.type === 'file') {
    if (typeof config.source.path !== 'string' || !config.source.path) fail('File source.path is required');
    for (const key of ['url', 'allowHttp', 'headers', 'timeoutMs']) if (safeOwn(config.source, key)) fail(`File source does not accept ${key}`);
  } else if (config.source.type === 'http') {
    if (safeOwn(config.source, 'path')) fail('HTTP source does not accept path');
    if (config.source.allowHttp !== undefined && typeof config.source.allowHttp !== 'boolean') fail('source.allowHttp must be boolean');
    checkedUrl(config.source.url, { allowHttp: config.source.allowHttp });
    if (config.source.timeoutMs !== undefined && (!Number.isInteger(config.source.timeoutMs) || config.source.timeoutMs < 100 || config.source.timeoutMs > 60_000)) fail('source.timeoutMs must be 100–60000');
    if (config.source.headers !== undefined) {
      object(config.source.headers, 'source.headers');
      for (const [name, reference] of Object.entries(config.source.headers)) {
        if (!/^[A-Za-z0-9-]+$/.test(name) || ['host', 'content-length', 'connection', 'transfer-encoding'].includes(name.toLowerCase())) fail('Invalid source header name');
        keys(reference, ['env'], 'header reference');
        if (typeof reference.env !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(reference.env)) fail('Each header requires an environment variable name');
      }
    }
  } else fail('source.type must be file or http');
  keys(config.format, ['type', 'encoding', 'delimiter', 'dataPath'], 'format');
  if (!['csv', 'json'].includes(config.format.type)) fail('format.type must be csv or json');
  if (!['utf-8', 'windows-874'].includes(config.format.encoding ?? 'utf-8')) fail('Supported encodings: utf-8, windows-874');
  if (config.format.type === 'csv') {
    if (safeOwn(config.format, 'dataPath')) fail('CSV format does not accept dataPath');
    validateDelimiter(config.format.delimiter ?? ',');
  } else {
    if (safeOwn(config.format, 'delimiter')) fail('JSON format does not accept delimiter');
    if (config.format.dataPath !== undefined) validatePath(config.format.dataPath);
  }
  if (config.missingValues !== undefined && (!Array.isArray(config.missingValues) || config.missingValues.length > 50 || config.missingValues.some((v) => typeof v !== 'string' || v.length > 100))) fail('missingValues must be an array of short strings');
  if (domain) {
    const required = DOMAIN_FIELDS[config.kind];
    const allowed = [...required, ...(config.kind === 'satellite' ? SATELLITE_OPTIONAL_FIELDS : []), 'sourceRecordId'];
    keys(config.fields, allowed, 'fields');
    keys(config.constants ?? {}, allowed, 'constants');
    for (const [name, mappedColumn] of Object.entries(config.fields)) {
      column(mappedColumn, `fields.${name}`);
      if (safeOwn(config.constants ?? {}, name)) fail(`Field ${name} cannot be both mapped and constant`);
    }
    for (const name of required) {
      if (!safeOwn(config.fields, name) && !safeOwn(config.constants ?? {}, name)) fail(`Configure a mapped field or constant for ${name}`);
    }
    for (const [name, value] of Object.entries(config.constants ?? {})) {
      if (value !== null && !['string', 'number'].includes(typeof value)) fail(`Constant ${name} must be text, a number, or null`);
    }
    return config;
  }
  keys(config.fields, ['stationId', 'observedAt', 'sourceRecordId'], 'fields');
  column(config.fields.stationId, 'fields.stationId');
  column(config.fields.observedAt, 'fields.observedAt');
  if (config.fields.sourceRecordId !== undefined) column(config.fields.sourceRecordId, 'fields.sourceRecordId');
  keys(config.timestamp, ['format', 'timezoneOffset'], 'timestamp');
  if (!['iso', 'local'].includes(config.timestamp.format)) fail('timestamp.format must be iso or local');
  if (config.timestamp.format === 'local') {
    const offset = config.timestamp.timezoneOffset;
    if (typeof offset !== 'string' || !/^[+-](?:0\d|1[0-3]):[0-5]\d$|^[+-]14:00$/.test(offset)) fail('Local timestamps require timezoneOffset such as +07:00');
  } else if (safeOwn(config.timestamp, 'timezoneOffset')) fail('ISO timestamps must carry their own offset');
  if (!Array.isArray(config.measurements) || !config.measurements.length || config.measurements.length > 20) fail('Configure 1–20 measurements');
  for (const measurement of config.measurements) {
    keys(measurement, ['metric', 'valueColumn', 'unit', 'aggregation', 'periodMinutes', 'qualityColumn', 'qualityMap'], 'measurement');
    column(measurement.valueColumn, 'measurement.valueColumn');
    // Validate measurement semantics through the shared API contract, even for an empty source.
    validateBatch({ schemaVersion: 1, sourceId: config.sourceId, batchId: 'config-check', observations: [{ stationId: 'config-check', observedAt: '2020-01-01T00:00:00Z', metric: measurement.metric, value: null, unit: measurement.unit, aggregation: measurement.aggregation, periodMinutes: measurement.periodMinutes, quality: 'missing' }] });
    if (measurement.qualityColumn !== undefined) {
      column(measurement.qualityColumn, 'measurement.qualityColumn');
      object(measurement.qualityMap, 'measurement.qualityMap');
      if (!Object.keys(measurement.qualityMap).length || Object.values(measurement.qualityMap).some((v) => !['reported', 'missing', 'suspect'].includes(v))) fail('qualityMap must map source codes to reported, missing, or suspect');
    } else if (measurement.qualityMap !== undefined) fail('qualityMap requires qualityColumn');
  }
  return config;
}

function validateDelimiter(delimiter) {
  if (typeof delimiter !== 'string' || delimiter.length !== 1 || ['"', '\r', '\n', '\0'].includes(delimiter)) fail('CSV delimiter must be one character other than quote/newline');
}

/** Strict CSV parser: quoted delimiters/newlines and escaped quotes are supported. */
export function parseCsv(text, delimiter = ',') {
  validateDelimiter(delimiter);
  text = text.replace(/^\uFEFF/, '');
  const records = [];
  let row = [], field = '', quoted = false, afterQuote = false, fieldStarted = false;
  const endField = () => { row.push(field); field = ''; afterQuote = false; fieldStarted = false; };
  const endRow = () => { endField(); records.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { quoted = false; afterQuote = true; }
      } else field += char;
      continue;
    }
    if (char === delimiter) { endField(); continue; }
    if (char === '\r' || char === '\n') { if (char === '\r' && text[i + 1] === '\n') i++; endRow(); continue; }
    if (afterQuote) fail('Unexpected character after a CSV closing quote');
    if (char === '"') { if (fieldStarted) fail('Unexpected quote in an unquoted CSV field'); quoted = true; fieldStarted = true; }
    else { field += char; fieldStarted = true; }
  }
  if (quoted) fail('Unclosed CSV quote');
  if (fieldStarted || afterQuote || row.length) endRow();
  if (!records.length) fail('CSV source is empty');
  const headers = records.shift().map((header) => header.trim());
  if (headers.some((header) => !header) || new Set(headers).size !== headers.length) fail('CSV headers must be nonempty and unique');
  return records.map((values, index) => {
    if (values.length !== headers.length) fail(`CSV row ${index + 2} has ${values.length} columns; expected ${headers.length}`);
    return Object.fromEntries(headers.map((header, i) => [header, values[i]]));
  });
}

function validatePath(path) {
  if (typeof path !== 'string' || !path || path.split('.').some((part) => !/^[A-Za-z0-9_-]+$/.test(part) || ['__proto__', 'prototype', 'constructor'].includes(part))) fail('dataPath must be a safe dot-separated object path');
}

function readColumn(row, name, index) {
  if (!safeOwn(row, name)) fail(`Source row ${index + 1} is missing mapped column ${name}`);
  return row[name];
}

function identifier(value, name, index) {
  if (typeof value === 'string') return value.trim();
  if (Number.isSafeInteger(value) && value >= 0) return String(value);
  fail(`Source row ${index + 1} has invalid ${name}`);
}

function timestamp(value, config, index) {
  if (typeof value !== 'string') fail(`Source row ${index + 1} timestamp must be text`);
  const trimmed = value.trim();
  if (config.format === 'iso') return trimmed;
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(trimmed);
  if (!match) fail(`Source row ${index + 1} requires Gregorian YYYY-MM-DD HH:mm:ss`);
  const parts = match.slice(1).map(Number);
  const [year, month, day, hour, minute, second] = parts;
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (year < 1900 || year > 2100 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day || date.getUTCHours() !== hour || date.getUTCMinutes() !== minute || date.getUTCSeconds() !== second) fail(`Source row ${index + 1} has an invalid Gregorian timestamp`);
  return `${trimmed.replace(' ', 'T')}${config.timezoneOffset}`;
}

function numeric(value, missing, index, name) {
  if (value === null) return null;
  if (!['string', 'number'].includes(typeof value)) fail(`Source row ${index + 1} has invalid numeric column ${name}`);
  const text = typeof value === 'string' ? value.trim() : String(value);
  if (missing.has(text)) return null;
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) fail(`Source row ${index + 1} has invalid numeric column ${name}`);
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) fail(`Source row ${index + 1} has a nonfinite number`);
  return parsed;
}

function transformDomainRows(rows, config, missing) {
  return rows.map((row, index) => {
    object(row, `Source row ${index + 1}`);
    const values = { ...config.constants };
    for (const [name, mappedColumn] of Object.entries(config.fields)) values[name] = readColumn(row, mappedColumn, index);
    return Object.fromEntries(Object.entries(values).map(([name, value]) => {
      if (DOMAIN_NUMERIC_FIELDS.has(name)) return [name, numeric(value, missing, index, name)];
      if (name === 'subdistrictCode' || name === 'sourceRecordId') return [name, identifier(value, name, index)];
      if (typeof value !== 'string') fail(`Source row ${index + 1} field ${name} must be text`);
      return [name, value.trim()];
    }));
  });
}

/** Column mappings use exact property names; only the JSON envelope uses dataPath. */
export function transformRows(rows, config) {
  validateCollectorConfig(config);
  if (!Array.isArray(rows) || !rows.length) fail('Source must contain at least one data row');
  if (rows.length * (config.kind ? 1 : config.measurements.length) > MAX_OBSERVATIONS) fail(`Batch exceeds ${MAX_OBSERVATIONS} observations; split the source window`);
  const missing = new Set((config.missingValues ?? ['']).map((value) => value.trim()));
  const observations = config.kind ? transformDomainRows(rows, config, missing) : rows.flatMap((row, index) => {
    object(row, `Source row ${index + 1}`);
    const stationId = identifier(readColumn(row, config.fields.stationId, index), 'stationId', index);
    const observedAt = timestamp(readColumn(row, config.fields.observedAt, index), config.timestamp, index);
    const sourceRecordId = config.fields.sourceRecordId === undefined ? undefined : identifier(readColumn(row, config.fields.sourceRecordId, index), 'sourceRecordId', index);
    return config.measurements.map((measurement) => {
      const value = numeric(readColumn(row, measurement.valueColumn, index), missing, index, measurement.valueColumn);
      let quality = value === null ? 'missing' : 'reported';
      if (measurement.qualityColumn !== undefined) {
        const rawQuality = readColumn(row, measurement.qualityColumn, index);
        if (!['string', 'number'].includes(typeof rawQuality)) fail(`Source row ${index + 1} has invalid quality code`);
        const code = String(rawQuality).trim();
        if (!safeOwn(measurement.qualityMap, code)) fail(`Source row ${index + 1} has an unmapped quality code`);
        quality = measurement.qualityMap[code];
      }
      return { stationId, observedAt, metric: measurement.metric, value, unit: measurement.unit, aggregation: measurement.aggregation, periodMinutes: measurement.periodMinutes, quality, ...(sourceRecordId === undefined ? {} : { sourceRecordId }) };
    });
  });
  const canonical = validateBatch({ schemaVersion: 1, ...(config.kind ? { kind: config.kind } : {}), sourceId: config.sourceId, batchId: 'pending', observations });
  const { batchId: _placeholder, ...identity } = canonical;
  const batchId = `sha256-${createHash('sha256').update(JSON.stringify(identity)).digest('hex')}`;
  return { ...canonical, batchId };
}

async function limitedFile(path, limit) {
  const chunks = [];
  let size = 0;
  try {
    for await (const chunk of createReadStream(path)) {
      size += chunk.length;
      if (size > limit) fail(`File exceeds ${limit} bytes`);
      chunks.push(chunk);
    }
  } catch (error) {
    if (error.message?.startsWith('File exceeds')) throw error;
    fail('Unable to read configured input file');
  }
  return Buffer.concat(chunks);
}

async function limitedResponse(response, limit) {
  const length = response.headers.get('content-length');
  if (length && Number(length) > limit) { await response.body?.cancel(); fail(`Source response exceeds ${limit} bytes`); }
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader(), chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); fail(`Source response exceeds ${limit} bytes`); }
      chunks.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}

export async function loadCollectorConfig(path) {
  let config;
  const bytes = await limitedFile(path, MAX_CONFIG_BYTES);
  try { config = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { fail('Config must contain valid UTF-8 JSON'); }
  return { config: validateCollectorConfig(config), baseDir: dirname(resolve(path)) };
}

export async function collectBatch(config, { baseDir = process.cwd(), filePath, env = process.env, fetchImpl = fetch } = {}) {
  validateCollectorConfig(config);
  let bytes;
  if (filePath !== undefined || config.source.type === 'file') {
    bytes = await limitedFile(filePath === undefined ? resolve(baseDir, config.source.path) : resolve(filePath), MAX_BODY_BYTES);
  } else {
    const headers = { Accept: config.format.type === 'json' ? 'application/json' : 'text/csv' };
    for (const [name, reference] of Object.entries(config.source.headers ?? {})) {
      const value = env[reference.env];
      if (typeof value !== 'string' || !value || /[\r\n]/.test(value)) fail(`Required source header environment variable is missing or invalid: ${reference.env}`);
      headers[name] = value;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.source.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    try {
      let response;
      try { response = await fetchImpl(checkedUrl(config.source.url, { allowHttp: config.source.allowHttp }), { method: 'GET', headers, redirect: 'manual', signal: controller.signal }); }
      catch { fail('Source request failed or timed out'); }
      if (!response.ok) { await response.body?.cancel(); fail(`Source returned HTTP ${response.status}; redirects are not followed`); }
      try { bytes = await limitedResponse(response, MAX_BODY_BYTES); }
      catch (error) { if (error.message?.startsWith('Source response exceeds')) throw error; fail('Source response failed or timed out'); }
    } finally { clearTimeout(timer); }
  }
  let text;
  try { text = new TextDecoder(config.format.encoding ?? 'utf-8', { fatal: true }).decode(bytes); }
  catch { fail('Source text does not match the configured encoding'); }
  let rows;
  if (config.format.type === 'csv') rows = parseCsv(text, config.format.delimiter ?? ',');
  else {
    try { rows = JSON.parse(text); } catch { fail('Source is not valid JSON'); }
    for (const part of (config.format.dataPath?.split('.') ?? [])) {
      if (!rows || typeof rows !== 'object' || !safeOwn(rows, part)) fail('JSON dataPath was not found');
      rows = rows[part];
    }
  }
  const batch = transformRows(rows, config);
  if (Buffer.byteLength(JSON.stringify(batch), 'utf8') > MAX_BODY_BYTES) fail(`Normalized batch exceeds ${MAX_BODY_BYTES} bytes; split the source window`);
  return batch;
}

const wait = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

async function verifyReceipt(response, batch) {
  const validType = /^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(response.headers.get('content-type') ?? '');
  if (!validType) { await response.body?.cancel(); fail('Submission did not return a JSON storage receipt'); }
  let receipt;
  try {
    receipt = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await limitedResponse(response, 16 * 1024)));
    if (!receipt || typeof receipt.created !== 'boolean' || receipt.created !== (response.status === 201)
      || receipt.batch?.sourceId !== batch.sourceId || receipt.batch?.batchId !== batch.batchId
      || receipt.batch?.contentHash !== hashBatch(batch) || receipt.batch?.observationCount !== batch.observations.length
      || !validateReceivedAt(receipt.batch?.receivedAt)) fail('Invalid receipt');
  } catch { fail('Submission receipt is invalid or does not match the submitted batch; retry the same batch'); }
  return receipt.batch;
}

/** Reuses the same validated body and batchId across retries; never follows redirects. */
export async function submitBatch(batch, endpoint, { token, fetchImpl = fetch, retries = 2, timeoutMs = DEFAULT_TIMEOUT_MS, sleep = wait } = {}) {
  const url = checkedUrl(endpoint, { upload: true });
  if (typeof token !== 'string' || !/^[A-Za-z0-9._~+\/-]{32,512}={0,2}$/.test(token)) fail('Submission requires a valid bearer token of at least 32 characters');
  if (!Number.isInteger(retries) || retries < 0 || retries > 3) fail('Submission retries must be 0–3');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 60_000) fail('Submission timeoutMs must be 100–60000');
  const canonical = validateBatch(batch);
  const body = JSON.stringify(canonical);
  if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) fail('Submission batch is too large');
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      try { response = await fetchImpl(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' }, body, redirect: 'manual', signal: controller.signal }); }
      catch { if (attempt === retries) fail('Submission failed or timed out after retries'); }
      if (response) {
        if (response.status === 200 || response.status === 201) {
          const receipt = await verifyReceipt(response, canonical);
          return { status: response.status, duplicate: response.status === 200, receivedAt: receipt.receivedAt };
        }
        await response.body?.cancel();
        const retryAfterSeconds = parseRetryAfter(response.headers.get('retry-after')) ?? (response.status === 429 ? 60 : null);
        if (!(response.status === 429 || response.status >= 500) || attempt === retries || retryAfterSeconds > 5) {
          const error = new Error(`Submission returned HTTP ${response.status}`);
          error.status = response.status;
          error.retryAfterSeconds = retryAfterSeconds;
          throw error;
        }
      }
    } finally { clearTimeout(timer); }
    const retryAfter = parseRetryAfter(response?.headers.get('retry-after'));
    await sleep(retryAfter !== null && retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt);
  }
  fail('Submission failed');
}
