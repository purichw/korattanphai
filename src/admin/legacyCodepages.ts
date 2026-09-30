// XLS 97–2003 uses UTF-16. Earlier Windows workbooks use the code page recorded
// in the file. Reuse the browser's decoders instead of shipping every encoding
// table (including unrelated DOS formats) with the operator workspace.
const labels: Record<number, string> = {
  874: 'windows-874', 932: 'shift_jis', 936: 'gbk', 949: 'euc-kr', 950: 'big5',
  1200: 'utf-16le', 1201: 'utf-16be', 1250: 'windows-1250', 1251: 'windows-1251',
  1252: 'windows-1252', 1253: 'windows-1253', 1254: 'windows-1254',
  1255: 'windows-1255', 1256: 'windows-1256', 1257: 'windows-1257',
  1258: 'windows-1258', 10000: 'macintosh', 65001: 'utf-8',
};
const decoders = new Map<number, TextDecoder>();
export const legacyCodepages = { utils: {
  decode(codepage: number, input: ArrayLike<number>) {
    const label = labels[codepage];
    if (!label) throw new Error(`ไฟล์ Excel ใช้รหัสภาษาเก่าที่ไม่รองรับ (${codepage}) กรุณาบันทึกใหม่เป็น .xlsx หรือ CSV UTF-8`);
    let decoder = decoders.get(codepage);
    if (!decoder) { decoder = new TextDecoder(label, { fatal: true, ignoreBOM: true }); decoders.set(codepage, decoder); }
    return decoder.decode(Uint8Array.from(input));
  },
  encode() { throw new Error('การนำเข้านี้รองรับการอ่าน Excel รุ่นเก่าเท่านั้น'); },
} };
