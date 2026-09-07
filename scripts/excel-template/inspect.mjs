import fs from 'node:fs/promises';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const input = process.argv[2];
if (!input) throw new Error('Pass the generated XLSX path');
const book = await SpreadsheetFile.importXlsx(await FileBlob.load(input));
console.log((await book.inspect({ kind: 'region', sheetId: 'วิเคราะห์', range: 'A8:I14', maxChars: 1600 })).ndjson);
const preview = await book.render({ sheetName: 'วิเคราะห์', range: 'A1:I33', scale: 1.3, format: 'png' });
await fs.writeFile('artifacts/excel-export/dashboard.png', new Uint8Array(await preview.arrayBuffer()));
