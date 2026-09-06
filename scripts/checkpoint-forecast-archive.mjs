import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(root, process.argv[2] ?? 'tmp-snapshots/rev03-db-checkpoint-20260906');
assert.ok(output.startsWith(path.join(root, 'tmp-snapshots/')), 'Checkpoint must stay inside project tmp-snapshots');
const project = (await fs.readFile(path.join(root, 'supabase/.temp/project-ref'), 'utf8')).trim();
assert.equal(project, 'dihchjflzhcekywarhxd');
await fs.mkdir(output, { recursive: false });
const run = promisify(execFile);
async function query(sql) {
  const { stdout } = await run('supabase', ['db', 'query', '--linked', sql, '--output', 'json', '--output-format', 'text'],
    { cwd: root, maxBuffer: 24 * 1024 * 1024, timeout: 90_000 });
  const result = JSON.parse(stdout);
  const rows = Array.isArray(result) ? result : result.rows;
  assert.ok(Array.isArray(rows), 'Expected SQL JSON rows');
  return rows;
}
const tables = [
  ['ktp_forecast_datasets', 'dataset_id'],
  ['ktp_forecast_runs', 'dataset_id, origin_period, horizon'],
  ['ktp_research_crosswalk', 'dataset_id, research_id'],
  ['ktp_forecast_values', 'dataset_id, origin_period, horizon, subdistrict_code'],
];
const manifest = { project, createdAt: new Date().toISOString(), tables: [], readOnly: true };
for (const [table, order] of tables) {
  const fingerprintSql = `select count(*)::integer as count,
    md5(coalesce(string_agg(to_jsonb(t)::text, E'\\n' order by ${order}), '')) as digest from public.${table} t`;
  const [before] = await query(fingerprintSql);
  const hash = createHash('md5');
  const file = `${table}.ndjson`;
  const handle = await fs.open(path.join(output, file), 'wx');
  let count = 0;
  try {
    for (let offset = 0; offset < before.count; offset += 10_000) {
      const rows = await query(`select to_jsonb(t)::text as row_text from public.${table} t order by ${order} limit 10000 offset ${offset}`);
      for (const { row_text: row } of rows) {
        JSON.parse(row);
        if (count) hash.update('\n');
        hash.update(row);
        await handle.write(`${row}\n`);
        count++;
      }
    }
  } finally { await handle.close(); }
  const digest = hash.digest('hex');
  assert.deepEqual({ count, digest }, before, `Incomplete checkpoint: ${table}`);
  assert.deepEqual((await query(fingerprintSql))[0], before, `Table changed during checkpoint: ${table}`);
  const bytes = await fs.readFile(path.join(output, file));
  manifest.tables.push({ table, file, count, databaseMd5: digest, sha256: createHash('sha256').update(bytes).digest('hex') });
  console.log(`[checkpoint] ${table}: ${count} rows verified`);
}
// Only counts/hashes of personal records are retained, never their contents.
manifest.preservedTables = await query(`select 'ktp_saved_filters' as name, count(*)::integer as count,
  md5(coalesce(string_agg(to_jsonb(t)::text, E'\\n' order by id), '')) as digest from public.ktp_saved_filters t
  union all select 'ktp_followed_areas', count(*)::integer,
  md5(coalesce(string_agg(to_jsonb(t)::text, E'\\n' order by user_id,area_code), '')) from public.ktp_followed_areas t`);
await fs.writeFile(path.join(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
console.log(`[checkpoint] Verified forecast-only backup: ${output}`);
