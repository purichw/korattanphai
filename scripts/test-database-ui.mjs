import { spawn } from 'node:child_process';
import { createServer } from 'vite';

// An isolated test server; never changes .env files or connects to a real project.
process.env.VITE_SUPABASE_URL = 'https://ktp-auth-test.supabase.co';
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test_only';
process.env.VITE_DATA_BACKEND = 'supabase';
const port = Number(process.env.DATABASE_TEST_PORT ?? 5189);
// Artifact files from concurrent local checks must not trigger page reloads.
const server = await createServer({
  // Worker-only imports escape the initial crawl. Prebundle them before tests so
  // a late optimizer update cannot replace React under another open test page.
  optimizeDeps: { include: ['@protobi/exceljs', '@xmldom/xmldom', 'jszip', 'jspdf', '@turf/boolean-point-in-polygon'] },
  server: {
    host: '127.0.0.1', port, strictPort: true, hmr: false,
    watch: { ignored: ['**/tmp-snapshots/**', '**/test-results/**', '**/artifacts/**'] },
  },
});
try {
  await server.listen();
  // Compile the dev-only module graph before assertions start. Cold production
  // loading/recovery remains covered separately by the protected-build suite.
  await server.warmupRequest('/src/main.tsx');
  await server.warmupRequest('/src/AuthenticatedApp.tsx');
  await server.environments.client.waitForRequestsIdle();
  const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', 'e2e/database-workspaces.spec.ts', 'e2e/bookmark-design.spec.ts', 'e2e/forecast-export.spec.ts', 'e2e/forecast-rev03-integrity.spec.ts', 'e2e/forecast-scoped-loading.spec.ts', 'e2e/forecast-risk-summary.spec.ts', 'e2e/forecast-map-tools.spec.ts', 'e2e/map-labels.spec.ts', 'e2e/workspace-search.spec.ts', 'e2e/forecast-analysis.spec.ts', 'e2e/searchable-select.spec.ts', 'e2e/subdistrict-layout.spec.ts', 'e2e/actual-forecast-separation.spec.ts', '--workers=2', ...process.argv.slice(2)], {
    stdio: 'inherit', env: { ...process.env, PLAYWRIGHT_BASE_URL: `http://127.0.0.1:${port}`, PLAYWRIGHT_DATA_BACKEND: 'supabase' },
  });
  process.exitCode = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', (code) => resolve(code ?? 1)); });
} finally { await server.close(); }
