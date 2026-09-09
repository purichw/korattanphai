import { pathToFileURL } from 'node:url';
import { backupModelInputs, retentionInventory } from '../server/model-inputs/recovery.mjs';
import { operationError, parseOptions, tokenFromEnv } from '../server/model-inputs/job-files.mjs';

const usage = `Usage: node scripts/backup-model-inputs.mjs --endpoint URL --source SOURCE --output NEW.json [--token-env NAME]
Inventory only: node scripts/backup-model-inputs.mjs --inventory DIR [--retention-days 30]
Exports one source through authenticated GET. Maximum 500 batches / 128 MiB; fails rather than truncating.
Output is exclusive. No credentials/endpoint are stored. An archive is not a complete Supabase backup.`;
export async function main(args = process.argv.slice(2)) {
  if (args.length === 1 && args[0] === '--help') { console.log(usage); return; }
  const options = parseOptions(args, ['--endpoint', '--source', '--output', '--token-env', '--inventory', '--retention-days']);
  if (options['--inventory']) {
    if (Object.keys(options).some(key => !['--inventory', '--retention-days'].includes(key))) throw operationError('invalid_arguments');
    console.log(JSON.stringify(await retentionInventory(options['--inventory'], { retentionDays: options['--retention-days'] === undefined ? 30 : Number(options['--retention-days']) })));
    return;
  }
  if (options['--retention-days']) throw operationError('invalid_arguments');
  console.log(JSON.stringify(await backupModelInputs({ endpoint: options['--endpoint'], sourceId: options['--source'], outputPath: options['--output'], token: tokenFromEnv(options['--token-env']) })));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => {
  if (error.code === 'backup_deferred') console.error(JSON.stringify({ state: 'deferred', retryAfterSeconds: error.retryAfterSeconds,
    action: 'Wait at least this long, then rerun the export. Source batches remain unchanged; no partial archive was published.' }));
  else console.error('Model input backup failed; check configuration, API availability, output path, and archive limits. No complete backup is claimed.');
  process.exitCode = 1;
});
