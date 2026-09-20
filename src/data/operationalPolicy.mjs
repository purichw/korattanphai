export const OPERATIONAL_POLICY_VERSION = 'actual-forecast-separation-v1';
export const BUSINESS_TIMEZONE = 'Asia/Bangkok';

export function isMonthPeriod(value) {
  return typeof value === 'string' && /^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(value);
}

export function businessMonth(now) {
  const date = new Date(now);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid business clock');
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: BUSINESS_TIMEZONE, year: 'numeric', month: '2-digit' }).formatToParts(date);
  return `${parts.find(part => part.type === 'year').value}-${parts.find(part => part.type === 'month').value}`;
}

export function operationalFamily(period, now) {
  if (!isMonthPeriod(period)) throw new Error('Invalid valid period');
  return period > businessMonth(now) ? 'forecast' : 'actual';
}

export function nextBusinessMonth(now) {
  const [year, month] = businessMonth(now).split('-').map(Number);
  return new Date(Date.UTC(year, month, 1) - 7 * 60 * 60 * 1000).toISOString();
}

// These are integration gaps, not a publication approval or a new archive ACL.
export const sourceAvailability = Object.freeze({
  actual: 'not_configured',
  forecast: 'publication_policy_unconfirmed',
});
