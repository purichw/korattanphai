import { pathToFileURL } from 'node:url';
import { runModelInputJob } from '../server/model-inputs/job-runner.mjs';
import { parseOptions, readJson, tokenFromEnv, operationError } from '../server/model-inputs/job-files.mjs';

const usage = `Usage: node scripts/run-model-input-job.mjs --state-dir PATH --submit URL [--config PATH | --resume RUN_ID] [--token-env NAME] [--policy PATH] [--attempts 3] [--recover-lock true]
Runs once; scheduling belongs to the team's scheduler. Resume reuses the frozen batch and policy.
Tokens are read from MODEL_INPUT_API_TOKEN by default and never written into job history.
Crash locks require explicit --recover-lock true and an absent owner PID on the same host.
Without confirmed freshness thresholds, observation/fetch timeliness remains unknown.`;

export async function main(args = process.argv.slice(2)) {
  if (args.length === 1 && args[0] === '--help') { console.log(usage); return; }
  const options = parseOptions(args, ['--state-dir', '--submit', '--config', '--resume', '--token-env', '--policy', '--attempts', '--recover-lock']);
  if (!options['--state-dir'] || !options['--submit'] || options['--recover-lock'] !== undefined && options['--recover-lock'] !== 'true') throw operationError('invalid_arguments');
  const result = await runModelInputJob({ stateDir: options['--state-dir'], endpoint: options['--submit'], configPath: options['--config'],
    resumeRunId: options['--resume'], token: tokenFromEnv(options['--token-env']), recoverLock: options['--recover-lock'] === 'true',
    attempts: options['--attempts'] === undefined ? 3 : Number(options['--attempts']), policy: options['--policy'] ? await readJson(options['--policy'], 16 * 1024) : undefined });
  console.log(JSON.stringify(result));
  if (result.state !== 'submitted') process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => { console.error('Model input job failed; check arguments, private state history, and source configuration. No batch is assumed delivered without a valid receipt.'); process.exitCode = 1; });
