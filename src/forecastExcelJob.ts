import type { ForecastExport } from './forecastExportModel';

export type ForecastExcelProgress = 'template' | 'workbook' | 'packaging';
export type ForecastExcelWorkerRequest = { type: 'start'; requestId: number; report: ForecastExport };
export type ForecastExcelWorkerMessage =
  | { type: 'progress'; requestId: number; stage: ForecastExcelProgress }
  | { type: 'complete'; requestId: number; buffer: ArrayBuffer }
  | { type: 'error'; requestId: number; code: 'workbook_failed' };

type Options = {
  signal?: AbortSignal;
  onProgress?: (stage: ForecastExcelProgress) => void;
  timeoutMs?: number;
};

export const FORECAST_EXCEL_TIMEOUT_MS = 90_000;
const MAX_TIMEOUT_MS = 180_000;
const stages = new Set<ForecastExcelProgress>(['template', 'workbook', 'packaging']);
let nextRequestId = 0;

/** Every export owns a worker so cancelling CPU-heavy Excel/ZIP work stops it. */
export function createForecastWorkbookJob(report: ForecastExport, { signal, onProgress, timeoutMs = FORECAST_EXCEL_TIMEOUT_MS }: Options = {}): Promise<ArrayBuffer> {
  if (signal?.aborted) return Promise.reject(new DOMException('Excel export was cancelled.', 'AbortError'));
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_TIMEOUT_MS) return Promise.reject(new RangeError('Excel export timeout must be 1–180000 milliseconds.'));
  if (typeof Worker === 'undefined') return Promise.reject(new DOMException('Excel export requires worker support.', 'NotSupportedError'));

  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      // Vite emits and rewrites this URL. Do not import the writer on the main thread.
      worker = new Worker(new URL('./forecastExcelWorker.ts', import.meta.url), { type: 'module', name: 'forecast-excel' });
    } catch {
      reject(new Error('Unable to start the Excel export worker.'));
      return;
    }
    const requestId = ++nextRequestId;
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => {
      if (timer !== undefined) clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      worker.removeEventListener('message', message);
      worker.removeEventListener('error', error);
      worker.removeEventListener('messageerror', messageError);
      worker.terminate();
    };
    const fail = (cause: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(cause);
    };
    const abort = () => fail(new DOMException('Excel export was cancelled.', 'AbortError'));
    const error = (event: ErrorEvent) => {
      event.preventDefault();
      fail(new Error('Excel export worker failed.'));
    };
    const messageError = () => fail(new Error('Unable to receive the Excel export result.'));
    const message = (event: MessageEvent<ForecastExcelWorkerMessage>) => {
      if (settled || !event.data || event.data.requestId !== requestId) return;
      if (event.data.type === 'progress') {
        if (stages.has(event.data.stage)) {
          // Progress rendering must not leave workbook generation orphaned.
          try { onProgress?.(event.data.stage); } catch { /* Completion remains authoritative. */ }
        }
        return;
      }
      if (event.data.type === 'complete' && event.data.buffer instanceof ArrayBuffer && event.data.buffer.byteLength > 0) {
        settled = true;
        cleanup();
        resolve(event.data.buffer);
        return;
      }
      fail(new Error('Excel export did not produce a complete workbook.'));
    };
    worker.addEventListener('message', message);
    worker.addEventListener('error', error);
    worker.addEventListener('messageerror', messageError);
    signal?.addEventListener('abort', abort, { once: true });
    // Covers cancellation between the first check and registering the listener.
    if (signal?.aborted) { abort(); return; }
    timer = setTimeout(() => fail(new DOMException('Excel export exceeded its time limit. Please retry.', 'TimeoutError')), timeoutMs);
    try { worker.postMessage({ type: 'start', requestId, report } satisfies ForecastExcelWorkerRequest); }
    catch { fail(new Error('Unable to send the report to the Excel export worker.')); }
  });
}
