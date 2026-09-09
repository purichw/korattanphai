import { validateTelemetry } from './telemetry.mjs';

const routes = new Set(['/api/model-inputs', '/api/health', '/api/telemetry']);
const thresholds = { LCP: 2500, INP: 200, CLS: 0.1 };
const percentile = (values, fraction) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1];

export function summarizeOperationalLogs(text) {
  const api = new Map(), vitals = new Map(); let ignoredLines = 0;
  for (const line of text.split('\n').filter(line => line.trim())) {
    try {
      const entry = JSON.parse(line);
      if (entry.event === 'api_request_completed' && routes.has(entry.route) && Number.isInteger(entry.status) && entry.status >= 100 && entry.status <= 599 && Number.isInteger(entry.durationMs) && entry.durationMs >= 0 && entry.durationMs <= 600000) {
        const current = api.get(entry.route) ?? { route: entry.route, requests: 0, errors5xx: 0, limited429: 0, durations: [] };
        current.requests++; current.errors5xx += Number(entry.status >= 500); current.limited429 += Number(entry.status === 429); current.durations.push(entry.durationMs);
        api.set(entry.route, current);
      } else if (entry.category === 'browser_operational_event') {
        const { category, receivedAt, ...body } = entry;
        const validated = validateTelemetry(body);
        if (validated.event !== 'web_vital') continue;
        const key = `${validated.route}/${validated.viewport}/${validated.metric}`;
        const current = vitals.get(key) ?? { route: validated.route, viewport: validated.viewport, metric: validated.metric, values: [] };
        current.values.push(validated.value); vitals.set(key, current);
      } else ignoredLines++;
    } catch { ignoredLines++; }
  }
  return {
    schemaVersion: 1,
    api: [...api.values()].map(({ durations, ...entry }) => ({ ...entry, latencyP95Ms: percentile(durations, 0.95) })),
    webVitals: [...vitals.values()].map(({ values, ...entry }) => {
      const p75 = percentile(values, 0.75), target = thresholds[entry.metric];
      return { ...entry, samples: values.length, p75, target, assessment: values.length < 20 ? 'insufficient_samples' : p75 <= target ? 'within_target' : 'above_target' };
    }),
    ignoredLines,
    limitations: ['API figures describe retained request logs, not uptime.', 'Performance/success events are sampled; failures are unsampled. Do not divide them to calculate a user error rate.', 'Viewport is a CSS-width category, not device identity. Under 20 samples is insufficient for even a preliminary comparison; a larger representative period is required for an SLO.'],
  };
}
