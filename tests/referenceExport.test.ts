import { describe, expect, it } from 'vitest';
import { referenceCsv } from '../src/admin/referenceExport';
import { readCsv } from '../src/admin/readDataFile';

describe('reference selection CSV', () => {
  it('exports Thai headers, original codes, quoted text, newlines and empty cells with BOM and CRLF', () => {
    const csv = referenceCsv(['รหัสตำบล', 'รายละเอียด', 'ว่าง'], [
      { cells: ['030101', 'ฝน, "เล็กน้อย"\nในเมือง', ''] },
      { cells: ['300102', 'โพธิ์กลาง', ''] },
    ]);
    expect(csv).toBe('\uFEFF"รหัสตำบล","รายละเอียด","ว่าง"\r\n"030101","ฝน, ""เล็กน้อย""\nในเมือง",""\r\n"300102","โพธิ์กลาง",""');
    expect(readCsv(csv).sheets[0].rows[0]).toEqual({ รหัสตำบล: '030101', รายละเอียด: 'ฝน, "เล็กน้อย"\nในเมือง', ว่าง: '' });
    expect(referenceCsv(['ชื่อ', 'รหัส'], [])).toBe('\uFEFF"ชื่อ","รหัส"');
    expect(referenceCsv([], [])).toBe('\uFEFF');
  });

  it.each(['=1+1', ' +SUM(A1:A2)', '-1+2', '@SUM(A1:A2)', '\t=1+1', '\r=1+1', '\n=1+1', ' \u0000=1+1', '\u200b=1+1', '\tธรรมดา', '-Infinity'])('keeps spreadsheet formula/control cells as text: %j', value => {
    expect(referenceCsv(['ค่า', 'หมายเหตุ'], [{ cells: [value, ''] }]))
      .toBe(`\uFEFF"ค่า","หมายเหตุ"\r\n"'${value}",""`);
  });

  it('guards headers too and preserves finite negative coordinates as numeric text', () => {
    expect(referenceCsv(['=header', 'ค่า'], [{ cells: ['-14.468471', '-.5'] }, { cells: ['-1e-3', '-0'] }]))
      .toBe('\uFEFF"\'=header","ค่า"\r\n"-14.468471","-.5"\r\n"-1e-3","-0"');
  });

  it('exports only the ordered subset supplied without mutating columns or source rows', () => {
    const columns = ['รหัส', 'ชื่อ'];
    const all = [
      { index: 9, cells: ['300101', 'ในเมือง'] },
      { index: 17, cells: ['300102', 'โพธิ์กลาง'] },
      { index: 42, cells: ['300103', 'หนองจะบก'] },
    ];
    const before = structuredClone({ columns, all });
    const csv = referenceCsv(columns, [all[2], all[0]]);
    expect(readCsv(csv).sheets[0].rows).toEqual([{ รหัส: '300103', ชื่อ: 'หนองจะบก' }, { รหัส: '300101', ชื่อ: 'ในเมือง' }]);
    expect({ columns, all }).toEqual(before);
  });
});
