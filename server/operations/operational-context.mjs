import { sendJson } from './http.mjs';
import { BUSINESS_TIMEZONE, OPERATIONAL_POLICY_VERSION, businessMonth, isMonthPeriod, nextBusinessMonth, operationalFamily, sourceAvailability } from '../../src/data/operationalPolicy.mjs';

// This endpoint publishes policy/clock metadata only. No archive records or
// protected source values are exposed, and query parameters cannot select kind.
export function createOperationalContextHandler({ now = () => new Date() } = {}) {
  return (request, response) => {
    if (request.method !== 'GET') {
      response.setHeader('Allow', 'GET');
      return sendJson(response, 405, { code: 'method_not_allowed' });
    }
    const params = new URL(request.url, 'http://local').searchParams;
    if ([...params.keys()].some(key => key !== 'period') || params.getAll('period').length > 1 ||
        (params.has('period') && !isMonthPeriod(params.get('period')))) {
      return sendJson(response, 400, { code: 'invalid_query' });
    }
    const serverNow = new Date(now()).toISOString();
    const currentPeriod = businessMonth(serverNow);
    // No eligible actual catalog is connected. Never use the archive's latest T.
    const validPeriod = params.get('period') ?? currentPeriod;
    return sendJson(response, 200, {
      policyVersion: OPERATIONAL_POLICY_VERSION, timezone: BUSINESS_TIMEZONE,
      serverNow, currentPeriod, validPeriod, nextBoundary: nextBusinessMonth(serverNow),
      family: operationalFamily(validPeriod, serverNow), sourceAvailability,
      actualPeriods: [], forecastPeriods: [], latestActualPeriod: null,
    });
  };
}
