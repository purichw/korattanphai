import { useEffect, useState } from 'react';
import { BUSINESS_TIMEZONE, OPERATIONAL_POLICY_VERSION, businessMonth, isMonthPeriod, operationalFamily } from './data/operationalPolicy.mjs';
import { emptyOperationalSnapshot, type OperationalSnapshot } from './operationalData';
import { forecastScopeCodes } from './data/forecastScope';

export type OperationalContext = {
  policyVersion: string; timezone: string; serverNow: string; currentPeriod: string;
  validPeriod: string; nextBoundary: string; family: 'actual' | 'forecast';
  actualPeriods: string[]; forecastPeriods: string[]; latestActualPeriod: string | null;
  sourceAvailability: { actual: 'not_configured'; forecast: 'publication_policy_unconfirmed' };
};

export function validateOperationalContext(value: unknown, requestedPeriod?: string): OperationalContext {
  const data = value as OperationalContext | null;
  if (!data || data.policyVersion !== OPERATIONAL_POLICY_VERSION || data.timezone !== BUSINESS_TIMEZONE ||
    !Number.isFinite(Date.parse(data.serverNow)) || !isMonthPeriod(data.validPeriod) ||
    (requestedPeriod && data.validPeriod !== requestedPeriod) || data.currentPeriod !== businessMonth(data.serverNow) ||
    data.family !== operationalFamily(data.validPeriod, data.serverNow) || !Number.isFinite(Date.parse(data.nextBoundary)) ||
    Date.parse(data.nextBoundary) <= Date.parse(data.serverNow) ||
    !Array.isArray(data.actualPeriods) || data.actualPeriods.length || !Array.isArray(data.forecastPeriods) || data.forecastPeriods.length ||
    data.latestActualPeriod !== null || data.sourceAvailability?.actual !== 'not_configured' ||
    data.sourceAvailability?.forecast !== 'publication_policy_unconfirmed') {
    // A newly connected feed must ship its reviewed adapter, not silently turn
    // catalogue metadata into observations in an older client.
    throw new Error('Unrecognized operational contract');
  }
  return data;
}

type Result = { key: string; status: 'loading' | 'error'; context?: never; snapshot?: never }
  | { key: string; status: 'ready'; context: OperationalContext; snapshot: OperationalSnapshot };

export function useOperationalContext(areaCode: string, period?: string, enabled = true) {
  const [attempt, setAttempt] = useState(0);
  const key = `${areaCode}|${period ?? 'default'}|${enabled}|${attempt}`;
  const [result, setResult] = useState<Result>({ key, status: 'loading' });
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let boundaryTimer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    setResult({ key, status: 'loading' });
    const refresh = () => { if (document.visibilityState === 'visible') setAttempt(value => value + 1); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    // No persistent operational cache: each revalidation consults server time
    // and the publication contract, independently of the forecast archive cache.
    const interval = setInterval(refresh, 60000);
    void (async () => {
      try {
        const response = await fetch(`/api/operational-context${period ? `?period=${encodeURIComponent(period)}` : ''}`, {
          signal: controller.signal, cache: 'no-store', credentials: 'same-origin',
        });
        if (!response.ok) throw new Error('Operational context request failed');
        const context = validateOperationalContext(await response.json(), period);
        const snapshot: OperationalSnapshot = { ...emptyOperationalSnapshot({ areaCode, validPeriod: context.validPeriod,
          hazard: 'drought', administrativeVersion: 'canonical-nakhon-ratchasima', metricDefinitionId: 'unconfigured-actual-drought' },
        context.serverNow, forecastScopeCodes(areaCode).length),
          reason: context.family === 'actual' ? 'actual_source_not_configured' : 'publication_policy_unconfirmed' };
        if (!active) return;
        setResult({ key, status: 'ready', context, snapshot });
        boundaryTimer = setTimeout(refresh, Math.min(60000, Date.parse(context.nextBoundary) - Date.parse(context.serverNow) + 50));
      } catch {
        if (active) setResult({ key, status: 'error' });
      } finally { clearTimeout(timeout); }
    })();
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timeout); clearTimeout(boundaryTimer); clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [key, areaCode, period, enabled, attempt]);
  // Hide the old snapshot synchronously, before the effect for new criteria runs.
  return { ...(result.key === key ? result : { key, status: 'loading' as const }), retry: () => setAttempt(value => value + 1) };
}
