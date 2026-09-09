import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeOperationalLogs } from '../../server/operations/log-summary.mjs';

test('log summary separates viewport percentiles and rejects unsafe/invalid events', () => {
  const events = [
    ...Array.from({ length: 20 }, (_, i) => ({ category: 'browser_operational_event', schemaVersion: 1, event: 'web_vital', code: 'LCP', metric: 'LCP', value: (i + 1) * 200, route: 'overview', viewport: 'mobile' })),
    { category: 'browser_operational_event', schemaVersion: 1, event: 'web_vital', code: 'CLS', metric: 'CLS', value: 0.05, route: 'overview', viewport: 'desktop' },
    { event: 'api_request_completed', route: '/api/model-inputs', status: 503, durationMs: 5000 },
    { event: 'api_request_completed', route: '/api/model-inputs', status: 429, durationMs: 100 },
    { event: 'api_request_completed', route: '/api/user-secret', status: 200, durationMs: 10 },
    { category: 'browser_operational_event', schemaVersion: 1, event: 'runtime_error', code: 'RENDER_FAILED', route: 'overview', viewport: 'mobile', message: 'private@example.com' },
  ];
  const report = summarizeOperationalLogs(events.map(JSON.stringify).join('\n'));
  assert.equal(report.webVitals[0].p75, 3000); assert.equal(report.webVitals[0].assessment, 'above_target');
  assert.equal(report.webVitals[1].assessment, 'insufficient_samples');
  assert.deepEqual(report.api, [{ route: '/api/model-inputs', requests: 2, errors5xx: 1, limited429: 1, latencyP95Ms: 5000 }]);
  assert.equal(report.ignoredLines, 2); assert(!JSON.stringify(report).includes('private@example.com'));
});
