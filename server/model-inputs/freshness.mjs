import { validateBatch, normalizeTimestamp } from './contract.mjs';
import { operationError } from './job-files.mjs';

export function validateFreshnessPolicy(policy = { schemaVersion: 1, mode: 'operational' }) {
  if (!policy || typeof policy !== 'object' || Array.isArray(policy) || policy.schemaVersion !== 1 || !['operational', 'historical'].includes(policy.mode)
    || Object.keys(policy).some(key => !['schemaVersion', 'mode', 'maxObservationAgeSeconds', 'maxFetchAgeSeconds'].includes(key))) throw operationError('invalid_freshness_policy');
  for (const key of ['maxObservationAgeSeconds', 'maxFetchAgeSeconds']) {
    if (policy[key] !== undefined && (!Number.isSafeInteger(policy[key]) || policy[key] < 1 || policy[key] > 10 * 366 * 86400)) throw operationError('invalid_freshness_policy');
  }
  if (policy.mode === 'historical' && Object.hasOwn(policy, 'maxObservationAgeSeconds')) throw operationError('historical_policy_has_live_threshold');
  return { ...policy };
}

/** Timeliness is independent of quality and of when a request happened to arrive. */
export function evaluateFreshness(input, { policy, fetchedAt, receivedAt = null, now = new Date().toISOString() } = {}) {
  const batch = validateBatch(input);
  const rules = validateFreshnessPolicy(policy);
  const checkAt = normalizeTimestamp(now), fetchAt = normalizeTimestamp(fetchedAt);
  if (receivedAt !== null) normalizeTimestamp(receivedAt.replace(/(\.\d{3})\d+/, '$1'));
  const boundaries = batch.observations.map(row => {
    if (batch.kind === 'satellite') {
      const [year, month] = row.period.split('-').map(Number);
      return new Date(Date.UTC(year, month, 1)).toISOString();
    }
    if (batch.kind === 'crop') return new Date(Date.parse(`${row.periodEnd}T00:00:00Z`) + 86400_000).toISOString();
    return row.observedAt;
  });
  const latestObservationEndAt = boundaries.sort().at(-1);
  const oldestObservationEndAt = boundaries[0];
  const observationAgeSeconds = (Date.parse(checkAt) - Date.parse(latestObservationEndAt)) / 1000;
  const fetchAgeSeconds = (Date.parse(checkAt) - Date.parse(fetchAt)) / 1000;
  const staleObservationCount = rules.mode === 'operational' && rules.maxObservationAgeSeconds !== undefined
    ? boundaries.filter(value => (Date.parse(checkAt) - Date.parse(value)) / 1000 > rules.maxObservationAgeSeconds).length : null;
  const futureObservationCount = boundaries.filter(value => Date.parse(value) > Date.parse(checkAt)).length;
  const observationStatus = rules.mode === 'historical' ? 'historical' : futureObservationCount ? 'future_timestamp'
    : staleObservationCount === null ? 'unknown' : staleObservationCount === boundaries.length ? 'stale' : staleObservationCount > 0 ? 'partial_stale' : 'fresh';
  const fetchStatus = fetchAgeSeconds < 0 ? 'future_timestamp' : rules.maxFetchAgeSeconds === undefined ? 'unknown'
    : fetchAgeSeconds > rules.maxFetchAgeSeconds ? 'stale' : 'fresh';
  return { checkedAt: checkAt, mode: rules.mode, observationStatus, fetchStatus,
    oldestObservationEndAt, latestObservationEndAt, fetchedAt: fetchAt, receivedAt, observationAgeSeconds, fetchAgeSeconds,
    staleObservationCount, futureObservationCount,
    qualityCounts: batch.observations.reduce((counts, row) => { counts[row.quality] = (counts[row.quality] ?? 0) + 1; return counts; }, {}),
    note: batch.kind ? 'Calendar period end is an exclusive UTC boundary; source availability remains separate.' : 'observedAt is the station observation/aggregation end; receipt is not observation time.' };
}
