export const OPERATIONAL_POLICY_VERSION: string;
export const BUSINESS_TIMEZONE: 'Asia/Bangkok';
export function isMonthPeriod(value: unknown): value is string;
export function businessMonth(now: string | number | Date): string;
export function operationalFamily(period: string, now: string | number | Date): 'actual' | 'forecast';
export function nextBusinessMonth(now: string | number | Date): string;
export const sourceAvailability: Readonly<{ actual: 'not_configured'; forecast: 'publication_policy_unconfirmed' }>;
