import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { API_UAT_SOURCES } from '../../scripts/prepare-api-uat.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const REF = 'abcdefghijklmnopqrst'; // Synthetic, never contacted.
const SECRET = 'uat-synthetic-database-key-not-a-credential';
const TOKEN = 'synthetic-only-writer-token-01234567890123456789';
const ENV = {
  KORAT_API_ENV: 'uat', MODEL_INPUT_SUPABASE_URL: `https://${REF}.supabase.co`,
  MODEL_INPUT_SUPABASE_SECRET_KEY: SECRET, MODEL_INPUT_API_TOKEN: TOKEN, MODEL_INPUT_SOURCE_ID: 'uat-test',
};
const cleanEnv = () => Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('MODEL_INPUT_') && key !== 'KORAT_API_ENV'));
async function location() {
  await fs.mkdir(path.join(ROOT, 'artifacts'), { recursive: true });
  return fs.mkdtemp(path.join(ROOT, 'artifacts/api-uat-package-test-'));
}
async function sourceFixture() {
  const root = await location();
  for (const name of [...API_UAT_SOURCES, 'scripts/prepare-api-uat.mjs']) {
    await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await fs.copyFile(path.join(ROOT, name), path.join(root, name));
  }
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  git(['init']);
  git(['add', '--', ...API_UAT_SOURCES, 'scripts/prepare-api-uat.mjs']);
  git(['-c', 'user.name=UAT Fixture', '-c', 'user.email=uat@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'Synthetic isolated test source']);
  const sourceCommit = git(['rev-parse', 'HEAD']).trim();
  const { prepareApiUat } = await import(pathToFileURL(path.join(root, 'scripts/prepare-api-uat.mjs')));
  return { root, git, sourceCommit, prepareApiUat };
}
async function fixture() {
  const source = await sourceFixture();
  return { ...source, ...await source.prepareApiUat({ supabaseProjectRef: REF, output: 'package' }) };
}
function build(output, env) {
  return execFileSync(process.execPath, ['verify-package.mjs'], { cwd: output, env: { ...cleanEnv(), ...env }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
function response() {
  return { headers: {}, statusCode: 200, setHeader(name, value) { this.headers[name] = value; }, end(value) { this.body = JSON.parse(value); } };
}

test('package contains only the real API closure and verified generated UAT files', async () => {
  const result = await fixture();
  const manifest = JSON.parse(await fs.readFile(path.join(result.output, 'source-manifest.json'), 'utf8'));
  assert.deepEqual(manifest.sources.map(row => row.path), API_UAT_SOURCES);
  assert.match(manifest.sourceCommit, /^[a-f0-9]{40}$/);
  for (const entry of manifest.sources) {
    const original = await fs.readFile(path.join(ROOT, entry.path));
    assert.equal(entry.sha256, createHash('sha256').update(original).digest('hex'));
    assert.deepEqual(await fs.readFile(path.join(result.output, 'runtime', entry.path)), original);
  }
  assert.deepEqual(await fs.readdir(path.join(result.output, 'public')), ['index.json']);
  for (const entry of manifest.files) {
    assert.ok(!/\.env|artifact|forecast|node_modules|\.git/.test(entry.path), entry.path);
    const bytes = await fs.readFile(path.join(result.output, entry.path), 'utf8');
    assert.ok(!bytes.includes(SECRET) && !bytes.includes(TOKEN));
  }
  assert.throws(() => build(result.output, {}), /Command failed/);
  const verified = JSON.parse(build(result.output, ENV));
  assert.equal(verified.configured, true);
  assert.equal(verified.sourceHash, result.sourceHash);
  assert.equal(verified.verifiedFiles, result.files);
});

test('package creation refuses production, existing output, escape paths and symlink parents', async () => {
  const { root: base, prepareApiUat } = await sourceFixture();
  await assert.rejects(prepareApiUat({ supabaseProjectRef: 'dihchjflzhcekywarhxd', output: path.join(base, 'prod') }), /non-production/);
  await assert.rejects(prepareApiUat({ supabaseProjectRef: REF, output: '../outside-uat-test' }), /inside this project/);
  await assert.rejects(prepareApiUat({ supabaseProjectRef: REF, output: base }), /inside this project/);
  const existing = path.join(base, 'existing');
  await fs.mkdir(existing);
  await assert.rejects(prepareApiUat({ supabaseProjectRef: REF, output: existing }), { code: 'EEXIST' });
  await fs.symlink(ROOT, path.join(base, 'linked-root'));
  await assert.rejects(prepareApiUat({ supabaseProjectRef: REF, output: path.join(base, 'linked-root', 'never-created') }), /symlinks/);
});

test('explicit source ref excludes dirty and untracked files without changing the checkout', async () => {
  const { root, sourceCommit, prepareApiUat, git } = await sourceFixture();
  const relative = 'shared/dataFields.mjs';
  const original = await fs.readFile(path.join(root, relative));
  await fs.appendFile(path.join(root, relative), '\nthrow new Error("unpublished runtime must not ship");\n');
  await fs.writeFile(path.join(root, 'private.env'), 'synthetic-untracked-value');
  const before = git(['status', '--porcelain']);
  await assert.rejects(prepareApiUat({ supabaseProjectRef: REF, output: 'dirty-default' }), /differs from HEAD/);
  const result = await prepareApiUat({ supabaseProjectRef: REF, output: 'committed', sourceRef: sourceCommit });
  assert.equal(result.sourceCommit, sourceCommit);
  assert.deepEqual(await fs.readFile(path.join(result.output, 'runtime', relative)), original);
  assert.equal(JSON.parse(build(result.output, ENV)).configured, true);
  assert.equal(git(['status', '--porcelain', '--', ...API_UAT_SOURCES, 'private.env']), before);
  await assert.rejects(fs.stat(path.join(result.output, 'private.env')), { code: 'ENOENT' });
});

test('invalid refs and committed symlink sources fail before creating a package', async () => {
  const { root, prepareApiUat, git } = await sourceFixture();
  for (const sourceRef of ['', '--help', 'missing-uat-ref', 'HEAD^{tree}', 42]) {
    await assert.rejects(prepareApiUat({ supabaseProjectRef: REF, output: 'invalid', sourceRef }), /local Git commit/);
  }
  // A synthetic Git index entry avoids deleting or replacing a real source file.
  const link = execFileSync('git', ['hash-object', '-w', '--stdin'], { cwd: root, input: 'private.env', encoding: 'utf8' }).trim();
  git(['update-index', '--cacheinfo', `120000,${link},shared/dataFields.mjs`]);
  git(['-c', 'user.name=UAT Fixture', '-c', 'user.email=uat@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'Synthetic unsafe source']);
  await assert.rejects(prepareApiUat({ supabaseProjectRef: REF, output: 'invalid', sourceRef: 'HEAD' }), /committed regular file/);
  await assert.rejects(fs.stat(path.join(root, 'invalid')), { code: 'ENOENT' });
});

test('CLI accepts a pinned source and rejects duplicate or unknown flags', async () => {
  const { root, sourceCommit } = await sourceFixture();
  const args = ['scripts/prepare-api-uat.mjs', '--supabase-project-ref', REF, '--output', 'cli-package', '--source-ref', sourceCommit];
  const result = JSON.parse(execFileSync(process.execPath, args, { cwd: root, encoding: 'utf8' }));
  assert.equal(result.sourceCommit, sourceCommit);
  assert.equal(JSON.parse(build(result.output, ENV)).configured, true);
  for (const tail of [['--output', 'duplicate'], ['--unknown', 'value']]) {
    assert.throws(() => execFileSync(process.execPath, [...args.slice(0, 5), ...tail], {
      cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
    }));
  }
});

test('runtime guard rejects wrong environment/database and preserves real authentication and storage paths', async () => {
  const { output } = await fixture();
  const { isUatConfigured } = await import(pathToFileURL(path.join(output, 'runtime/uat-config.mjs')));
  assert.equal(isUatConfigured(ENV), true);
  for (const override of [
    { KORAT_API_ENV: 'production' }, { KORAT_API_ENV: undefined },
    { MODEL_INPUT_SUPABASE_URL: 'https://dihchjflzhcekywarhxd.supabase.co' },
    { MODEL_INPUT_SUPABASE_URL: 'https://zyxwvutsrqponmlkjihg.supabase.co' },
    { MODEL_INPUT_SUPABASE_URL: `https://${REF}.supabase.co/other` },
    { MODEL_INPUT_SUPABASE_URL: `https://${REF}.supabase.co?redirect=prod` },
    { MODEL_INPUT_SUPABASE_URL: `https://${REF}.supabase.co.evil.example` },
    { MODEL_INPUT_SUPABASE_SECRET_KEY: '' }, { MODEL_INPUT_API_TOKEN: 'weak' },
  ]) assert.equal(isUatConfigured({ ...ENV, ...override }), false, JSON.stringify(Object.keys(override)));

  const previousEnv = { ...process.env };
  const previousFetch = globalThis.fetch;
  const requests = [];
  try {
    for (const key of Object.keys(process.env)) if (key.startsWith('MODEL_INPUT_') || key === 'KORAT_API_ENV') delete process.env[key];
    Object.assign(process.env, ENV);
    globalThis.fetch = async (url) => {
      requests.push(String(url));
      return Response.json(String(url).includes('/rpc/')
        ? [{ allowed: true, retry_after_seconds: 0, remaining_minute: 59, remaining_daily: 9999 }]
        : []);
    };
    const { default: handler } = await import(pathToFileURL(path.join(output, 'api/model-inputs.js')));
    process.env.MODEL_INPUT_SUPABASE_URL = 'https://dihchjflzhcekywarhxd.supabase.co';
    const blocked = response();
    await handler({ method: 'GET', url: '/api/model-inputs', headers: { authorization: `Bearer ${TOKEN}` } }, blocked);
    assert.equal(blocked.statusCode, 503);
    assert.equal(blocked.body.error.code, 'service_not_configured');
    assert.match(blocked.headers['X-Request-ID'], /^[a-f0-9-]{36}$/);
    assert.deepEqual(requests, []);
    Object.assign(process.env, ENV);
    const denied = response();
    await handler({ method: 'GET', url: '/api/model-inputs', headers: {} }, denied);
    assert.equal(denied.statusCode, 401);
    assert.deepEqual(requests, []);
    const accepted = response();
    await handler({ method: 'GET', url: '/api/model-inputs', headers: { authorization: `Bearer ${TOKEN}` } }, accepted);
    assert.equal(accepted.statusCode, 200);
    assert.deepEqual(accepted.body, { items: [], nextCursor: null });
    assert.equal(requests.length, 2);
    assert.ok(requests.every(url => new URL(url).origin === ENV.MODEL_INPUT_SUPABASE_URL));
    const { default: health } = await import(pathToFileURL(path.join(output, 'api/health.js')));
    const healthy = response();
    health({ method: 'GET' }, healthy);
    assert.equal(healthy.body.configured, true);
    assert.equal(healthy.body.check, 'configuration_only');
    assert.ok(!JSON.stringify(healthy.body).includes(SECRET) && !JSON.stringify(healthy.body).includes(TOKEN));
    assert.equal(requests.length, 2, 'health must not claim or perform a live DB probe');
    process.env.KORAT_API_ENV = 'production';
    const unhealthy = response();
    health({ method: 'GET' }, unhealthy);
    assert.equal(unhealthy.statusCode, 503);
    assert.equal(unhealthy.body.configured, false);
  } finally {
    globalThis.fetch = previousFetch;
    for (const key of Object.keys(process.env)) if (key.startsWith('MODEL_INPUT_') || key === 'KORAT_API_ENV') delete process.env[key];
    for (const [key, value] of Object.entries(previousEnv)) if (key.startsWith('MODEL_INPUT_') || key === 'KORAT_API_ENV') process.env[key] = value;
  }
});

test('build refuses tampered runtime bytes and an unexpected public source file', async () => {
  const first = await fixture();
  await fs.appendFile(path.join(first.output, 'runtime/server/model-inputs/contract.mjs'), '\n// modified\n');
  assert.throws(() => build(first.output, ENV), /Command failed/);
  const second = await fixture();
  await fs.writeFile(path.join(second.output, 'public/leaked-source.js'), 'export default "not public";\n');
  assert.throws(() => build(second.output, ENV), /Command failed/);
});
