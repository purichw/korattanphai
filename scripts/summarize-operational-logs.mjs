import { open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { summarizeOperationalLogs } from '../server/operations/log-summary.mjs';

try {
  if (process.argv.length !== 4 || process.argv[2] !== '--file') throw new Error('Invalid arguments');
  const file = await open(process.argv[3], constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > 16 * 1024 * 1024) throw new Error('Invalid log file');
    const buffer = Buffer.alloc(16 * 1024 * 1024 + 1);
    let size = 0;
    while (size < buffer.length) { const result = await file.read(buffer, size, buffer.length - size, null); if (!result.bytesRead) break; size += result.bytesRead; }
    if (size > 16 * 1024 * 1024) throw new Error('Invalid log file');
    console.log(JSON.stringify(summarizeOperationalLogs(buffer.subarray(0, size).toString('utf8')), null, 2));
  } finally { await file.close(); }
} catch {
  console.error('Cannot summarize logs. Use --file with a regular JSONL file no larger than 16 MiB.');
  process.exitCode = 1;
}
