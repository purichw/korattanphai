import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { collectBatch, loadCollectorConfig, submitBatch } from '../server/model-inputs/collector.mjs';

const usage = `Usage: node scripts/collect-model-inputs.mjs --config PATH [--file PATH] [--output PATH] [--submit URL] [--token-env NAME]

Without --submit, prints a validated batch. --output creates a new file (never overwrites).
File source paths resolve relative to the config; --file and --output resolve from the working directory.
Submission reads its bearer token from MODEL_INPUT_API_TOKEN or --token-env NAME.
Configs support station observations, monthly satellite features, or crop yield records.
Satellite configs ingest prepared feature tables; they do not process raw satellite imagery.
No source is polled automatically. Run again when the source has a new observation window.`;

export async function main(args = process.argv.slice(2)) {
  if (args.includes('--help')) { console.log(usage); return; }
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    if (!['--config', '--file', '--output', '--submit', '--token-env'].includes(name) || !args[index + 1] || args[index + 1].startsWith('--') || options[name] !== undefined) throw new Error(usage);
    options[name] = args[index + 1];
  }
  if (!options['--config']) throw new Error(usage);
  if (options['--token-env'] && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(options['--token-env'])) throw new Error('--token-env requires an environment variable name');
  const { config, baseDir } = await loadCollectorConfig(options['--config']);
  const batch = await collectBatch(config, { baseDir, filePath: options['--file'] });
  const serialized = `${JSON.stringify(batch, null, 2)}\n`;
  if (options['--output']) await writeFile(options['--output'], serialized, { flag: 'wx', mode: 0o600 });
  if (options['--submit']) {
    const result = await submitBatch(batch, options['--submit'], { token: process.env[options['--token-env'] ?? 'MODEL_INPUT_API_TOKEN'] });
    console.log(JSON.stringify({ ...(batch.kind ? { kind: batch.kind } : {}), sourceId: batch.sourceId, batchId: batch.batchId, observationCount: batch.observations.length, ...result }));
  } else if (!options['--output']) console.log(serialized.trimEnd());
  else console.log(JSON.stringify({ ...(batch.kind ? { kind: batch.kind } : {}), sourceId: batch.sourceId, batchId: batch.batchId, observationCount: batch.observations.length, output: options['--output'] }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    // Do not emit source bodies, request headers, URLs, or stack traces containing secrets.
    const fileError = ['EACCES', 'EPERM', 'ENOENT', 'ENOSPC', 'EISDIR', 'ENOTDIR'].includes(error.code);
    console.error(`Collector: ${error.code === 'EEXIST' ? 'Output file already exists; choose a new path' : fileError ? 'Unable to write output file' : error.message}`);
    process.exitCode = 1;
  });
}
