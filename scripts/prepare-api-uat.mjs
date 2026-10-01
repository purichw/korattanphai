import { constants } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PRODUCTION_REF = 'dihchjflzhcekywarhxd';
const MATRIX = 'src/data/canonical/nakhon_ratchasima/district_subdistrict_matrix.json';
export const API_UAT_SOURCES = Object.freeze([
  'api/model-inputs.js',
  'server/model-inputs/handler.mjs',
  'server/model-inputs/storage.mjs',
  'server/model-inputs/contract.mjs',
  'server/model-inputs/domain-contract.mjs',
  'shared/dataFields.mjs',
  'server/operations/integration-auth.mjs',
  'server/operations/rate-limit.mjs',
  'server/operations/request-log.mjs',
  MATRIX,
]);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => `${JSON.stringify(value, null, 2)}\n`;

async function directory(location, { exclusive = false } = {}) {
  if (exclusive) await fs.mkdir(location, { mode: 0o700 });
  else await fs.mkdir(location, { mode: 0o700 }).catch(error => { if (error.code !== 'EEXIST') throw error; });
  const stat = await fs.lstat(location);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Package paths must be real directories, not symlinks.');
}

async function readSource(relative) {
  let current = ROOT;
  for (const component of relative.split('/').slice(0, -1)) {
    current = path.join(current, component);
    const stat = await fs.lstat(current);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Unsafe source directory: ${relative}`);
  }
  const handle = await fs.open(path.join(ROOT, relative), constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > 2 * 1024 * 1024) throw new Error(`Invalid or oversized source: ${relative}`);
    return await handle.readFile();
  } finally { await handle.close(); }
}

function committedSource(commit, relative) {
  const entry = execFileSync('git', ['ls-tree', '-z', commit, '--', relative], { cwd: ROOT, encoding: 'utf8' });
  const match = /^(100644|100755) blob ([a-f0-9]{40})\t([^\0]+)\0$/.exec(entry);
  if (!match || match[3] !== relative) throw new Error(`Source must be a committed regular file: ${relative}`);
  return execFileSync('git', ['cat-file', 'blob', match[2]], { cwd: ROOT, maxBuffer: 2 * 1024 * 1024 });
}

// This function is serialized into the isolated package; it has no repository dependencies.
async function verifyPackage() {
  const fs = await import('node:fs/promises');
  const { createHash } = await import('node:crypto');
  const { fileURLToPath } = await import('node:url');
  const root = new URL('./', import.meta.url);
  const manifest = JSON.parse(await fs.readFile(new URL('source-manifest.json', root), 'utf8'));
  const expected = new Map(manifest.files.map(entry => [entry.path, entry]));
  const actual = [];
  async function visit(relative = '') {
    for (const entry of await fs.readdir(new URL(relative || './', root), { withFileTypes: true })) {
      // The Vercel CLI owns this metadata directory; it is never publicly served.
      if (relative === '' && entry.name === '.vercel' && entry.isDirectory()) continue;
      const name = `${relative}${entry.name}`;
      if (entry.isDirectory()) await visit(`${name}/`);
      else if (entry.isFile()) actual.push(name);
      else throw new Error('Package contains a symlink or unsupported file.');
    }
  }
  await visit();
  const allowed = [...expected.keys(), 'source-manifest.json'].sort();
  if (JSON.stringify(actual.sort()) !== JSON.stringify(allowed)) throw new Error('Package file inventory does not match its manifest.');
  for (const [name, entry] of expected) {
    if (!/^(?:api|runtime|public)\/[A-Za-z0-9_./-]+$/.test(name) && !['package.json', 'vercel.json', 'verify-package.mjs'].includes(name)
      || name.split('/').includes('..')) throw new Error('Unsafe package manifest path.');
    const bytes = await fs.readFile(new URL(name, root));
    if (bytes.length !== entry.bytes || createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw new Error(`Package checksum failed: ${name}`);
  }
  const pkg = JSON.parse(await fs.readFile(new URL('package.json', root), 'utf8'));
  const config = JSON.parse(await fs.readFile(new URL('vercel.json', root), 'utf8'));
  if (pkg.type !== 'module' || pkg.engines?.node !== '24.x' || pkg.dependencies || pkg.devDependencies
    || config.outputDirectory !== 'public' || config.framework !== null || config.buildCommand !== 'node verify-package.mjs'
    || config.functions?.['api/model-inputs.js']?.includeFiles !== 'runtime/src/data/canonical/nakhon_ratchasima/district_subdistrict_matrix.json'
    || config.rewrites || actual.filter(name => name.startsWith('public/')).join() !== 'public/index.json') throw new Error('Unsafe UAT build or public-file configuration.');
  const { isUatConfigured } = await import(new URL('runtime/uat-config.mjs', root));
  if (!isUatConfigured()) throw new Error('UAT configuration is missing or does not match the isolated project.');
  // Import verifies the real API dependency graph and canonical matrix without a network call.
  await import(new URL('api/model-inputs.js', root));
  const sourceHash = createHash('sha256').update(JSON.stringify(manifest.sources)).digest('hex');
  if (sourceHash !== manifest.sourceHash) throw new Error('Source manifest hash is invalid.');
  console.log(JSON.stringify({ service: manifest.service, environment: 'uat', sourceHash, sourceCommit: manifest.sourceCommit, verifiedFiles: actual.length, configured: true }));
}

export async function prepareApiUat({ supabaseProjectRef, output, sourceRef } = {}) {
  if (typeof supabaseProjectRef !== 'string' || !/^[a-z0-9]{20}$/.test(supabaseProjectRef) || supabaseProjectRef === PRODUCTION_REF) {
    throw new Error('Supply a non-production Supabase project ref containing 20 lowercase letters/digits.');
  }
  if (typeof output !== 'string' || !output) throw new Error('An exclusive --output directory is required.');
  const destination = path.resolve(ROOT, output);
  const relative = path.relative(ROOT, destination);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Output must be a new directory inside this project.');
  if (sourceRef !== undefined && (typeof sourceRef !== 'string' || !sourceRef || sourceRef.startsWith('-'))) {
    throw new Error('Source ref must identify a local Git commit.');
  }
  let sourceCommit;
  try {
    sourceCommit = execFileSync('git', ['rev-parse', '--verify', '--end-of-options', `${sourceRef ?? 'HEAD'}^{commit}`], {
      cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch { throw new Error('Source ref must identify a local Git commit.'); }
  // Default refuses dirty runtime. An explicit ref reads immutable Git blobs only.
  if (sourceRef === undefined && execFileSync('git', ['diff', '--name-only', 'HEAD', '--', ...API_UAT_SOURCES], { cwd: ROOT, encoding: 'utf8' }).trim()) {
    throw new Error('API source differs from HEAD; review and commit the runtime before packaging.');
  }
  const sourceBytes = new Map();
  for (const name of API_UAT_SOURCES) {
    const bytes = committedSource(sourceCommit, name);
    if (sourceRef === undefined && !bytes.equals(await readSource(name))) {
      throw new Error(`API source differs from HEAD: ${name}`);
    }
    sourceBytes.set(name, bytes);
  }
  const sources = [...sourceBytes].map(([name, bytes]) => ({ path: name, bytes: bytes.length, sha256: sha256(bytes) }));
  const sourceHash = sha256(JSON.stringify(sources));
  const metadata = { service: 'korat-model-inputs-uat', environment: 'uat', builtAt: new Date().toISOString(), sourceCommit, sourceHash };
  const files = new Map([...sourceBytes].map(([name, bytes]) => [`runtime/${name}`, bytes]));
  files.set('runtime/uat-metadata.mjs', `export default ${JSON.stringify(metadata)};\n`);
  files.set('runtime/uat-config.mjs', `import { clientsFromEnvironment, createIntegrationAuth } from './server/operations/integration-auth.mjs';
import { createSupabaseRateLimiter, rateLimitOptionsFromEnvironment } from './server/operations/rate-limit.mjs';
import { createSupabaseStore } from './server/model-inputs/storage.mjs';
const EXPECTED_URL = ${JSON.stringify(`https://${supabaseProjectRef}.supabase.co`)};
export function isUatConfigured(env = process.env) {
  try {
    if (env.KORAT_API_ENV !== 'uat' || ![EXPECTED_URL, EXPECTED_URL + '/'].includes(env.MODEL_INPUT_SUPABASE_URL)
      || EXPECTED_URL === 'https://${PRODUCTION_REF}.supabase.co') return false;
    createIntegrationAuth({ token: env.MODEL_INPUT_API_TOKEN || undefined, readToken: env.MODEL_INPUT_READ_TOKEN || undefined, sourceId: env.MODEL_INPUT_SOURCE_ID, clients: clientsFromEnvironment(env.MODEL_INPUT_CLIENTS_JSON) });
    createSupabaseStore({ url: env.MODEL_INPUT_SUPABASE_URL, key: env.MODEL_INPUT_SUPABASE_SECRET_KEY });
    createSupabaseRateLimiter({ url: env.MODEL_INPUT_SUPABASE_URL, key: env.MODEL_INPUT_SUPABASE_SECRET_KEY, ...rateLimitOptionsFromEnvironment(env) });
    return true;
  } catch { return false; }
}
export function sendJson(response, status, body) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.end(JSON.stringify(body));
}
`);
  files.set('api/model-inputs.js', `import handler from '../runtime/api/model-inputs.js';
import { unavailableHandler } from '../runtime/server/model-inputs/handler.mjs';
import { isUatConfigured } from '../runtime/uat-config.mjs';
export default async function uatModelInputs(request, response) {
  if (!isUatConfigured()) return unavailableHandler(request, response);
  return handler(request, response);
}
`);
  files.set('api/health.js', `import metadata from '../runtime/uat-metadata.mjs';
import { isUatConfigured, sendJson } from '../runtime/uat-config.mjs';
export default function health(request, response) {
  if (request.method !== 'GET') { response.setHeader('Allow', 'GET'); return sendJson(response, 405, { error: 'method_not_allowed' }); }
  const configured = isUatConfigured();
  return sendJson(response, configured ? 200 : 503, { ...metadata, check: 'configuration_only', configured });
}
`);
  files.set('public/index.json', json({ ...metadata, healthPath: '/api/health' }));
  files.set('package.json', json({ name: 'korat-model-inputs-uat', version: '1.0.0', private: true, type: 'module', engines: { node: '24.x' }, scripts: { build: 'node verify-package.mjs' } }));
  files.set('vercel.json', json({
    framework: null, installCommand: 'node --version', buildCommand: 'node verify-package.mjs', outputDirectory: 'public',
    functions: { 'api/model-inputs.js': { includeFiles: `runtime/${MATRIX}` } },
    headers: [{ source: '/(.*)', headers: [{ key: 'Cache-Control', value: 'no-store' }, { key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'X-Frame-Options', value: 'DENY' }] }],
  }));
  files.set('verify-package.mjs', `${verifyPackage.toString()}\nawait verifyPackage().catch(() => { console.error('UAT package/config verification failed.'); process.exitCode = 1; });\n`);
  const entries = [...files].map(([name, value]) => { const bytes = Buffer.from(value); return { path: name, bytes: bytes.length, sha256: sha256(bytes) }; });
  files.set('source-manifest.json', json({ ...metadata, sources, files: entries }));
  let parent = ROOT;
  for (const component of relative.split(path.sep).slice(0, -1)) { parent = path.join(parent, component); await directory(parent); }
  await directory(destination, { exclusive: true });
  for (const [name, bytes] of files) {
    await fs.mkdir(path.dirname(path.join(destination, name)), { recursive: true, mode: 0o700 });
    await fs.writeFile(path.join(destination, name), bytes, { flag: 'wx', mode: 0o600 });
  }
  return { output: destination, sourceCommit, sourceHash, files: files.size };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    if (![4, 6].includes(args.length) || new Set(args.filter((_, index) => index % 2 === 0)).size !== args.length / 2) throw new Error('Usage: node scripts/prepare-api-uat.mjs --supabase-project-ref REF --output NEWDIR [--source-ref COMMIT]');
    const options = {};
    for (let index = 0; index < args.length; index += 2) {
      if (args[index] === '--supabase-project-ref') options.supabaseProjectRef = args[index + 1];
      else if (args[index] === '--output') options.output = args[index + 1];
      else if (args[index] === '--source-ref') options.sourceRef = args[index + 1];
      else throw new Error('Unknown option.');
    }
    if (!options.supabaseProjectRef || !options.output) throw new Error('Both --supabase-project-ref and --output are required.');
    console.log(JSON.stringify(await prepareApiUat(options)));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
