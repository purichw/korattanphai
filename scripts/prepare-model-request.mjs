import { readFile, writeFile, stat } from 'node:fs/promises';
import { prepareModelRequest } from '../server/model-inputs/model-contract.mjs';

try {
  const args = process.argv.slice(2);
  const options = {}, batches = [];
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i], value = args[i + 1];
    if (!['--batch', '--origin', '--cutoff', '--areas', '--history-months', '--output'].includes(flag) || !value) throw new Error('Usage: --batch PATH (repeatable) --origin YYYY-MM --cutoff ISO --areas CODE,CODE [--history-months 36] [--output PATH]');
    if (flag === '--batch') {
      if (batches.length >= 100 || (await stat(value)).size > 2 * 1024 * 1024) throw new Error('Input batch size/count exceeded.');
      batches.push(JSON.parse(await readFile(value, 'utf8')));
    } else {
      if (options[flag] !== undefined) throw new Error('Repeated option.');
      options[flag] = value;
    }
  }
  const request = prepareModelRequest({ batches, originMonth: options['--origin'], informationCutoff: options['--cutoff'], subdistrictCodes: options['--areas']?.split(','), historyMonths: options['--history-months'] === undefined ? 36 : Number(options['--history-months']) });
  const output = `${JSON.stringify(request, null, 2)}\n`;
  if (options['--output']) await writeFile(options['--output'], output, { flag: 'wx', mode: 0o600 });
  else process.stdout.write(output);
} catch (error) {
  process.stderr.write(`Model request: ${error.code === 'EEXIST' ? 'Output already exists; choose a new path.' : error.code && error.code !== 'invalid_batch' ? 'Unable to read/write a batch file.' : error.message}\n`);
  process.exitCode = 1;
}
