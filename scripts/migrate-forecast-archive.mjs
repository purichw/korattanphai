import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { archiveAuditSql, assertArchiveAudit, buildDraftSql, buildMonthSql, forecastImport, inspectArchive, publishArchiveSql, sha256 } from './lib/forecast-rev03-migration.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const command = process.argv[2] ?? 'check';
if (!['check', 'import', 'verify', 'publish'].includes(command)) throw new Error('Use check, import, verify, or publish');
const archiveBytes = await fs.readFile(path.join(root, forecastImport.runtimePath));
if (sha256(archiveBytes) !== forecastImport.canonicalSha) throw new Error('Canonical archive changed; re-audit before migration');
const archive = JSON.parse(archiveBytes);
const expected = inspectArchive(archive);
if (['check', 'import', 'publish'].includes(command)) {
  const sourceDir = process.env.FORECAST_WORKBOOK_DIR;
  if (!sourceDir) throw new Error('Set FORECAST_WORKBOOK_DIR to the directory containing the approved rev03 original workbook');
  for (const [name, hash] of [[forecastImport.original, forecastImport.originalSha]]) {
    if (sha256(await fs.readFile(path.join(sourceDir, name))) !== hash) throw new Error(`Unapproved workbook: ${name}`);
  }
}
console.log(`[archive] Verified approved rev03 input; ${expected.rows} predictions, ${expected.outOfScope} explicit out-of-scope cells.`);
if (command === 'check') process.exit(0);
const linked = (await fs.readFile(path.join(root, 'supabase/.temp/project-ref'), 'utf8')).trim();
if (linked !== forecastImport.project) throw new Error('Wrong linked project; refusing database access');
const outputDir = await fs.mkdtemp(path.join(root, 'tmp-snapshots/archive-migration-'));
const run = promisify(execFile);
let sequence = 0;
async function query(sql, readRows = false) {
  const file = path.join(outputDir, `${String(++sequence).padStart(3, '0')}.sql`);
  await fs.writeFile(file, sql);
  const { stdout } = await run('supabase', ['db', 'query', '--linked', '--file', file, '--output', 'json', '--output-format', 'text'], { cwd: root, maxBuffer: 10 * 1024 * 1024, timeout: 90_000 });
  if (!readRows) return;
  const result = JSON.parse(stdout);
  const rows = Array.isArray(result) ? result : result.rows;
  if (!Array.isArray(rows)) throw new Error('Expected SQL JSON rows; check CLI output before continuing');
  return rows;
}
if (command === 'import') {
  await query(buildDraftSql(archive));
  for (let start = 0; start < archive.targetMonths.length; start += 12) {
    const months = archive.targetMonths.slice(start, start + 12);
    await query(months.map((month) => buildMonthSql(archive, month.period)).join('\n'));
    console.log(`[archive] Staged ${months[0].period} through ${months.at(-1).period}`);
  }
}
const results = await query(archiveAuditSql(), true);
assertArchiveAudit(results[0], expected);
if (command === 'publish') await query(publishArchiveSql(expected));
await fs.writeFile(path.join(outputDir, 'verification.json'), JSON.stringify({ command, checkedAt: new Date().toISOString(), version: forecastImport.version, ...results[0] }, null, 2));
console.log(`[archive] Exact prediction digest verified. ${command === 'publish' ? 'Dataset published.' : 'No publication performed.'} Evidence: ${outputDir}`);
