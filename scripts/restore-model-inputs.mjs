import { pathToFileURL } from 'node:url';
import { restoreModelInputs } from '../server/model-inputs/recovery.mjs';
import { operationError, parseOptions } from '../server/model-inputs/job-files.mjs';

const usage = `Usage: node scripts/restore-model-inputs.mjs --archive FILE --target-dir EMPTY_LOCAL_DIR [--resume true]
Verify only: node scripts/restore-model-inputs.mjs --archive FILE --verify-only true
Validates all checksums before writing, preserves source receivedAt, and verifies restored batches.
Resume requires the same archive and exact matching existing batches. Never restores to a remote API.
Reports export age and measured local restore time; production database/raw assets require separate drills.`;
export async function main(args = process.argv.slice(2)) {
  if (args.length === 1 && args[0] === '--help') { console.log(usage); return; }
  const options = parseOptions(args, ['--archive', '--target-dir', '--resume', '--verify-only']);
  if (!options['--archive'] || ['--resume', '--verify-only'].some(key => options[key] !== undefined && options[key] !== 'true')
    || options['--verify-only'] && (options['--target-dir'] || options['--resume'])) throw operationError('invalid_arguments');
  console.log(JSON.stringify(await restoreModelInputs({ archivePath: options['--archive'], targetDir: options['--target-dir'], resume: options['--resume'] === 'true', verifyOnly: options['--verify-only'] === 'true' })));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => { console.error('Model input restore failed; verify archive integrity and use an empty local target, or resume the same archive. Existing files are never overwritten.'); process.exitCode = 1; });
