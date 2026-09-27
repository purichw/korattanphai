import { describe, it, expect } from 'vitest';
import ExcelJS from '@protobi/exceljs';
import { createAdminWorkbook, mapImportRows, readAdminWorkbook } from '../src/admin/workbook';
import { DATA_FIELDS } from '../shared/dataFields.mjs';
import type { Payload } from '../src/admin/types';

describe('CMS Excel/API parity', () => {
  it('round-trips zero, null, leading-zero identifiers, offsets and optional provenance', async () => {
    const payload: Payload = { schemaVersion: 1, sourceId: 'test-source', batchId: 'test-v1', observations: [
      { stationId: '001', observedAt: '2026-09-01T07:00:00+07:00', metric: 'rainfall', value: 0,
        unit: 'mm', aggregation: 'sum', periodMinutes: 60, quality: 'reported', sourceRecordId: '0001' },
      { stationId: '002', observedAt: '2026-09-01T07:00:00+07:00', metric: 'rainfall', value: null,
        unit: 'mm', aggregation: 'sum', periodMinutes: 60, quality: 'missing' },
    ] };
    const bytes = await createAdminWorkbook('station', payload);
    const imported = await readAdminWorkbook(new Uint8Array(bytes).buffer);
    const mapping = Object.fromEntries(DATA_FIELDS.station.map(field => [field.key, field.key]));
    expect({ ...imported.metadata, observations: mapImportRows('station', imported.sheets[0], mapping) }).toEqual(payload);
    const book = new ExcelJS.Workbook(); await book.xlsx.load(new Uint8Array(bytes).buffer);
    expect(book.getWorksheet('Data')!.getCell('A1').font.name).toBe('Cordia New');
    expect(book.getWorksheet('Data')!.getCell('A2').alignment).toMatchObject({ vertical: 'middle', horizontal: 'center' });
  });

  it('requires an explicit disposition for every source column and does not guess codes or numbers', () => {
    const sheet = { name: 'Data', columns: ['code', 'value', 'extra'], rows: [{ code: 1, value: '1,200', extra: 'keep' }] };
    expect(() => mapImportRows('station', sheet, { stationId: 'code', value: 'value' })).toThrow('ยังมีคอลัมน์');
    expect(mapImportRows('station', sheet, { stationId: 'code', value: 'value' }, ['extra'])).toEqual([{ stationId: 1, value: '1,200' }]);
    expect(() => mapImportRows('station', sheet, { stationId: 'code', value: 'code' }, ['value', 'extra'])).toThrow('เพียง field เดียว');
  });

  it('retains formula-looking text literally and rejects actual Excel formulas', async () => {
    const payload: Payload = { schemaVersion: 1, sourceId: 'test-source', batchId: 'v1', observations: [{ sourceRecordId: '=1+1' }] };
    const bytes = await createAdminWorkbook('station', payload);
    const imported = await readAdminWorkbook(new Uint8Array(bytes).buffer);
    expect(imported.sheets[0].rows[0].sourceRecordId).toBe('=1+1');
    const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet('Data');
    sheet.addRow(['value']); sheet.addRow([{ formula: '1+1', result: 2 }]);
    const bad = await workbook.xlsx.writeBuffer();
    await expect(readAdminWorkbook(new Uint8Array(bad).buffer)).rejects.toThrow('พบสูตร');
  });
});
