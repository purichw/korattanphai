import { isMonthPeriod } from './data/operationalPolicy.mjs';
import { forecastTargetPeriod } from './forecastPeriod';

export function readOperationalLocation(search: string) {
  const query = new URLSearchParams(search);
  if (query.get('mapLayer') === 'forecast-archive') return { intent: 'archive' as const };
  if (query.has('period')) {
    const period = query.get('period');
    return isMonthPeriod(period) && query.getAll('period').length === 1
      ? { intent: 'operational' as const, period: period! }
      : { intent: 'invalid' as const };
  }
  // Legacy "target" is the origin T, not the valid month.
  if (query.has('target')) {
    const origin = query.get('target');
    const horizon = Number(query.get('horizon') ?? 1);
    if (!isMonthPeriod(origin) || query.getAll('target').length !== 1 || query.getAll('horizon').length > 1 || !Number.isInteger(horizon) || horizon < 1 || horizon > 6) return { intent: 'invalid' as const };
    return { intent: 'operational' as const, period: forecastTargetPeriod(origin!, horizon) };
  }
  return { intent: 'operational' as const, period: undefined };
}

export function operationalPath(path: string, period?: string) {
  const url = new URL(path, 'https://local.invalid');
  // Archive-only criteria must not leak into actual or acquire new meanings.
  for (const key of ['mapLayer', 'target', 'horizon', 'risk', 'mapRisk', 'irrigation', 'period', 'district']) url.searchParams.delete(key);
  if (period) url.searchParams.set('period', period);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function archivePath(path: string) {
  const url = new URL(operationalPath(path), 'https://local.invalid');
  url.searchParams.set('mapLayer', 'forecast-archive');
  return `${url.pathname}${url.search}`;
}
