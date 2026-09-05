import { spawn } from 'node:child_process';
import { createServer } from 'vite';

// An isolated test server; never changes .env files or connects to a real project.
process.env.VITE_SUPABASE_URL = 'https://ktp-auth-test.supabase.co';
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test_only';
process.env.VITE_DATA_BACKEND = 'supabase';
const port = Number(process.env.DATABASE_TEST_PORT ?? 5189);
const server = await createServer({ server: { host: '127.0.0.1', port, strictPort: true, watch: { ignored: ['**/tmp-snapshots/**', '**/test-results/**'] } } });
try {
  await server.listen();
  const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', 'e2e/database-workspaces.spec.ts', '--workers=2', ...process.argv.slice(2)], {
    stdio: 'inherit', env: { ...process.env, PLAYWRIGHT_BASE_URL: `http://127.0.0.1:${port}`, PLAYWRIGHT_DATA_BACKEND: 'supabase' },
  });
  process.exitCode = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', (code) => resolve(code ?? 1)); });
} finally { await server.close(); }
