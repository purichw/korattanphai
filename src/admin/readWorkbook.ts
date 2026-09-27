import type { ImportFile } from './workbook';

// Parsing large workbooks must not block typing, scrolling or the close button.
export function readWorkbookInWorker(bytes: ArrayBuffer, signal: AbortSignal): Promise<ImportFile> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./workbook.worker.ts', import.meta.url), { type: 'module' });
    const finish = (error?: Error, result?: ImportFile) => {
      window.clearTimeout(timeout); signal.removeEventListener('abort', cancel); worker.terminate();
      if (error) reject(error); else resolve(result!);
    };
    const cancel = () => finish(new DOMException('ยกเลิกอ่านไฟล์', 'AbortError'));
    const timeout = window.setTimeout(() => finish(new Error('อ่านไฟล์นานเกิน 60 วินาที กรุณาแบ่งไฟล์')), 60000);
    worker.onmessage = event => event.data.error ? finish(new Error(event.data.error)) : finish(undefined, event.data.result);
    worker.onerror = () => finish(new Error('อ่าน Excel ไม่สำเร็จ กรุณาตรวจไฟล์ต้นฉบับ'));
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) cancel(); else worker.postMessage(bytes, [bytes]);
  });
}
