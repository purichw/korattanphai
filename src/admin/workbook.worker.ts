import { readAdminWorkbook } from './workbook';
self.onmessage = async (event: MessageEvent<ArrayBuffer>) => {
  try { self.postMessage({ result: await readAdminWorkbook(event.data) }); }
  catch (error) { self.postMessage({ error: error instanceof Error ? error.message : 'อ่านไฟล์ไม่สำเร็จ' }); }
};
