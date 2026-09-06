import fs from 'node:fs/promises';
import { buildRev03Archive, readRev03Inputs, rev03, sha256 } from './lib/forecast-rev03.mjs';

const archive = buildRev03Archive(await readRev03Inputs());
const bytes = `${JSON.stringify(archive)}\n`;
await fs.writeFile(rev03.runtimePath, bytes, { flag: 'wx' });
console.log(JSON.stringify({ path: rev03.runtimePath, sha256: sha256(bytes),
  sourceIds: archive.locations.length, runs: archive.targetMonths.length * 6,
  values: archive.meta.forecastVintageCount, latest: archive.targetMonths.at(-1).horizons }, null, 2));
