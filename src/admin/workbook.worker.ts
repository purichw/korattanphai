import { readDataFile, type CsvEncoding, type DataFileFormat } from './readDataFile';
self.onmessage = async (event: MessageEvent<{ bytes: ArrayBuffer; format: DataFileFormat; encoding: CsvEncoding }>) => {
  try { self.postMessage({ result: await readDataFile(event.data.bytes, event.data.format, event.data.encoding) }); }
  catch (error) { self.postMessage({ error: error instanceof Error ? error.message : 'อ่านไฟล์ไม่สำเร็จ' }); }
};
