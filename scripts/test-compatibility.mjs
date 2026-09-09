import { spawn } from 'node:child_process';

const child = spawn(process.execPath, ['scripts/run-playwright.mjs', 'e2e/nfr-recovery.spec.ts', '--project=webkit-mobile', '--project=firefox-desktop', '--workers=2', ...process.argv.slice(2)], {
  stdio: 'inherit', env: { ...process.env, PLAYWRIGHT_COMPAT: '1' },
});
child.on('error', () => { console.error('Compatibility runner could not start.'); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
