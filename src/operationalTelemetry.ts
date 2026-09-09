/** Operational counters only: never pass an Error, user, URL, or form value here. */
export type OperationalEvent = 'runtime_error' | 'resource_error' | 'forecast_load' | 'map_load' | 'web_vital';
export type OperationalCode = 'RENDER_FAILED' | 'UNHANDLED_ERROR' | 'UNHANDLED_REJECTION' | 'RESOURCE_FAILED'
  | 'LOAD_OK' | 'LOAD_FAILED' | 'LOAD_TIMEOUT' | 'LCP' | 'INP' | 'CLS';
export type OperationalRoute = 'login' | 'overview' | 'province' | 'district' | 'subdistrict' | 'other';
export type OperationalMetric = 'LCP' | 'INP' | 'CLS';
type EventInput = { event: OperationalEvent; code: OperationalCode; durationMs?: number;
  metric?: OperationalMetric; value?: number; requestId?: string };

const codes: Record<OperationalEvent, readonly OperationalCode[]> = {
  runtime_error: ['RENDER_FAILED', 'UNHANDLED_ERROR', 'UNHANDLED_REJECTION'],
  resource_error: ['RESOURCE_FAILED'], forecast_load: ['LOAD_OK', 'LOAD_FAILED', 'LOAD_TIMEOUT'],
  map_load: ['LOAD_OK', 'LOAD_FAILED', 'LOAD_TIMEOUT'], web_vital: ['LCP', 'INP', 'CLS'],
};

export function operationalRoute(path: string): OperationalRoute {
  // Reduce even unexpected input to a category; never serialize the path itself.
  const pathname = path.split(/[?#]/, 1)[0];
  if (/^\/login\/?$/.test(pathname)) return 'login';
  if (pathname === '/') return 'overview';
  if (pathname === '/drought' || /^\/p-\d+$/.test(pathname)) return 'province';
  if (/^\/[a-z-]+\/t-\d{6}\/?$/.test(pathname)) return 'subdistrict';
  if (/^\/[a-z-]+\/?$/.test(pathname)) return 'district';
  return 'other';
}

export function createOperationalReporter({ enabled, sample = Math.random() < 0.1 }: { enabled: boolean; sample?: boolean }) {
  let sent = 0;
  let pending = 0;
  const seen = new Set<string>();
  return (input: EventInput) => {
    if (!enabled || navigator.doNotTrack === '1' || sent >= 20 || pending >= 4 || !codes[input.event]?.includes(input.code)) return;
    if ((input.event === 'web_vital' || input.code === 'LOAD_OK') && !sample) return;
    const route = operationalRoute(window.location.pathname);
    const key = `${input.event}|${input.code}|${route}`;
    if (seen.has(key)) return;
    // Explicit projection is intentional: even a caller with extra properties cannot leak them.
    const body: Record<string, string | number> = { schemaVersion: 1, event: input.event, code: input.code, route,
      viewport: window.innerWidth < 768 ? 'mobile' : 'desktop' };
    if (Number.isFinite(input.durationMs) && input.durationMs! >= 0) body.durationMs = Math.min(600_000, Math.round(input.durationMs!));
    if (input.event === 'web_vital') {
      if (input.metric !== input.code || !Number.isFinite(input.value) || input.value! < 0) return;
      body.metric = input.metric;
      body.value = Math.min(input.metric === 'CLS' ? 100 : 600_000, Math.round(input.value! * 1000) / 1000);
    }
    if (typeof input.requestId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.requestId)) body.requestId = input.requestId;
    seen.add(key); sent++; pending++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    try {
      void fetch('/api/telemetry', { method: 'POST', body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' }, credentials: 'omit', referrerPolicy: 'no-referrer',
        cache: 'no-store', mode: 'same-origin', keepalive: true, signal: controller.signal,
      }).catch(() => { /* Telemetry must never interrupt the workspace or retry itself. */ })
        .finally(() => { clearTimeout(timer); pending--; });
    } catch { clearTimeout(timer); pending--; }
  };
}

export const reportOperationalEvent = createOperationalReporter({ enabled: import.meta.env.VITE_OPERATIONAL_TELEMETRY_ENABLED === 'true' });

export function startOperationalTelemetry() {
  if (import.meta.env.VITE_OPERATIONAL_TELEMETRY_ENABLED !== 'true' || navigator.doNotTrack === '1') return () => {};
  const onError = (event: Event) => reportOperationalEvent(event instanceof ErrorEvent
    ? { event: 'runtime_error', code: 'UNHANDLED_ERROR' } : { event: 'resource_error', code: 'RESOURCE_FAILED' });
  const onRejection = () => reportOperationalEvent({ event: 'runtime_error', code: 'UNHANDLED_REJECTION' });
  window.addEventListener('error', onError, true);
  window.addEventListener('unhandledrejection', onRejection);
  let active = true;
  // No attribution SDK: entries, DOM targets, query strings and metric IDs are not collected.
  void import('web-vitals').then(({ onLCP, onINP, onCLS }) => {
    if (!active) return;
    const delivered = new Set<string>();
    const report = ({ name, value }: { name: string; value: number }) => {
      if (!active || delivered.has(name) || !['LCP', 'INP', 'CLS'].includes(name)) return;
      delivered.add(name);
      reportOperationalEvent({ event: 'web_vital', code: name as OperationalMetric, metric: name as OperationalMetric, value });
    };
    onLCP(report); onINP(report); onCLS(report);
  }).catch(() => { /* Optional instrumentation cannot block application startup. */ });
  return () => { active = false; window.removeEventListener('error', onError, true); window.removeEventListener('unhandledrejection', onRejection); };
}
