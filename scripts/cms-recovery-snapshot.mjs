import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { PGlite } from '@electric-sql/pglite';

// Read-only remote snapshot; restore is restricted to an ephemeral local database.
const mode = process.argv[2];
assert.ok(['capture', 'rehearse'].includes(mode), 'Use capture or rehearse');
const output = path.resolve(process.env.CMS_SNAPSHOT_DIR ?? 'artifacts/cms-recovery');
const linkedRoot = path.resolve(process.env.CMS_LINKED_ROOT ?? process.cwd());
const tables = ['ktp_districts', 'ktp_subdistricts', 'ktp_forecast_datasets',
  'ktp_research_crosswalk', 'ktp_forecast_runs', 'ktp_forecast_values',
  'ktp_followed_areas', 'ktp_saved_filters'];
const identifier = name => { assert.match(name, /^[a-z_][a-z0-9_]*$/); return `"${name}"`; };
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const literal = value => `'${String(value).replaceAll("'", "''")}'`;
function query(sql) {
  const result = execFileSync('supabase', ['db', 'query', '--linked', '--output', 'json', sql],
    { cwd: linkedRoot, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  return JSON.parse(result).rows;
}
const rowQuery = (table, columns, predicate = 'true') => `select coalesce(jsonb_agg(row_value order by row_value::text),'[]'::jsonb) as data
  from (select jsonb_build_array(${columns.map(identifier).join(',')}) as row_value from public.${identifier(table)} where ${predicate}) snapshot`;
async function save(name, value) { await fs.writeFile(path.join(output, name), JSON.stringify(value), { mode: 0o600, flag: 'wx' }); }

if (mode === 'capture') {
  assert.equal((await fs.readFile(path.join(linkedRoot, 'supabase/.temp/project-ref'), 'utf8')).trim(), 'dihchjflzhcekywarhxd');
  await fs.mkdir(output, { recursive: true, mode: 0o700 });
  const schema = query(`select table_name,column_name,ordinal_position,is_generated from information_schema.columns
    where table_schema='public' order by table_name,ordinal_position`);
  assert.deepEqual([...new Set(schema.map(c => c.table_name))].sort(), [...tables].sort(), 'Unexpected live tables: review snapshot scope first');
  const metadata = {
    at: new Date().toISOString(), project: 'dihchjflzhcekywarhxd', schema,
    authIds: query('select id from auth.users order by id').map(row => row.id),
    functions: query(`select p.proname,pg_get_functiondef(p.oid) definition,p.proacl::text acl
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by p.proname`),
    policies: query("select * from pg_policies where schemaname='public' order by tablename,policyname"),
    grants: query("select * from information_schema.role_table_grants where table_schema='public' order by table_name,grantee,privilege_type"),
    constraints: query(`select c.relname,con.conname,pg_get_constraintdef(con.oid) definition from pg_constraint con
      join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' order by c.relname,con.conname`),
    parts: [],
  };
  for (const table of tables) {
    const columns = schema.filter(c => c.table_name === table && c.is_generated === 'NEVER').map(c => c.column_name);
    const predicates = table === 'ktp_forecast_values'
      ? query('select distinct extract(year from origin_period)::integer as year from public.ktp_forecast_values order by year')
        .map(({ year }) => { assert.ok(Number.isInteger(year)); return `extract(year from origin_period)=${year}`; }) : ['true'];
    for (const [index, predicate] of predicates.entries()) {
      const rows = query(rowQuery(table, columns, predicate))[0].data;
      const file = `${table}-${index}.json`;
      await save(file, rows);
      metadata.parts.push({ table, columns, predicate, file, rows: rows.length, digest: digest(rows) });
      console.log(JSON.stringify({ snapshot: table, part: index, rows: rows.length }));
    }
  }
  await save('manifest.json', metadata);
  console.log('Snapshot complete. No remote data changed; no Auth credentials exported.');
} else {
  const metadata = JSON.parse(await fs.readFile(path.join(output, 'manifest.json'), 'utf8'));
  assert.equal(metadata.project, 'dihchjflzhcekywarhxd');
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth,public to authenticated,anon;`);
    for (const id of metadata.authIds) await db.query('insert into auth.users values($1)', [id]);
    await db.exec(await fs.readFile('supabase/baseline/20260905_existing.sql', 'utf8'));
    for (const migration of ['20260905110000_archive_and_saved_workspaces.sql', '20260905124000_target_month_archive_publication.sql',
      '20260906010000_saved_filter_irrigation.sql', '20260906160000_rev03_origin_forecast.sql', '20260907040000_scoped_forecast_reads.sql']) {
      await db.exec(await fs.readFile(`supabase/migrations/${migration}`, 'utf8'));
    }
    // Restore published historical rows verbatim only inside this throwaway DB.
    await db.exec('set session_replication_role=replica');
    for (const part of metadata.parts) {
      assert.ok(tables.includes(part.table));
      const rows = JSON.parse(await fs.readFile(path.join(output, part.file), 'utf8'));
      assert.equal(rows.length, part.rows); assert.equal(digest(rows), part.digest);
      for (let offset = 0; offset < rows.length; offset += 2000) {
        const records = rows.slice(offset, offset + 2000).map(values => Object.fromEntries(part.columns.map((key, index) => [key, values[index]])));
        const columns = part.columns.map(identifier).join(',');
        await db.query(`insert into public.${identifier(part.table)}(${columns})
          select ${columns} from jsonb_populate_recordset(null::public.${identifier(part.table)},$1::jsonb)`, [JSON.stringify(records)]);
      }
      const restored = (await db.query(rowQuery(part.table, part.columns, part.predicate))).rows[0].data;
      assert.equal(digest(restored), part.digest, `Restored fields differ: ${part.file}`);
    }
    await db.exec('set session_replication_role=origin');
    const original = metadata.functions.find(fn => fn.proname === 'ktp_latest_forecast_revision');
    assert.ok(original);
    await db.exec(original.definition);
    const before = (await db.query('select ktp_latest_forecast_revision() revision')).rows[0].revision;
    for (const migration of ['20260909010000_model_input_batches.sql', '20260927010000_cms_data_drafts.sql',
      '20260927020000_cms_forecast_review.sql', '20260927030000_cms_reference_resources.sql']) {
      await db.exec(await fs.readFile(`supabase/migrations/${migration}`, 'utf8'));
    }
    const after = (await db.query('select ktp_latest_forecast_revision() revision')).rows[0].revision;
    assert.deepEqual(after, before);
    for (const part of metadata.parts) {
      assert.equal(digest((await db.query(rowQuery(part.table, part.columns, part.predicate))).rows[0].data), part.digest);
    }
    const report = { checkedAt: new Date().toISOString(), restoredRows: metadata.parts.reduce((sum, part) => sum + part.rows, 0),
      parts: metadata.parts.length, everyFieldMatches: true, migrationsPreserveEveryExistingRow: true, unchangedPublication: before.datasetId };
    await save('rehearsal.json', report); console.log(JSON.stringify(report, null, 2));
  } finally { await db.close(); }
}
