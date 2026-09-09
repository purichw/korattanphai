import { createForecastWorkbook } from './forecastExcelWriter';
import type { ForecastExcelWorkerMessage, ForecastExcelWorkerRequest } from './forecastExcelJob';

// Keep worker types local rather than adding conflicting DOM/WebWorker globals
// to the React application's TypeScript compilation.
const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<ForecastExcelWorkerRequest>) => void) | null;
  postMessage(message: ForecastExcelWorkerMessage, transfer?: Transferable[]): void;
  close(): void;
};
let started = false;

scope.onmessage = async ({ data }) => {
  if (started || !data || data.type !== 'start' || !Number.isSafeInteger(data.requestId) || data.requestId < 1) return;
  started = true;
  const { requestId, report } = data;
  try {
    const bytes = await createForecastWorkbook(report, undefined, {
      onProgress: stage => scope.postMessage({ type: 'progress', requestId, stage }),
    });
    // A ZIP view can have an offset or a pooled backing store. Transfer only the
    // workbook's own bytes, never unrelated bytes from the backing allocation.
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    scope.postMessage({ type: 'complete', requestId, buffer }, [buffer]);
  } catch {
    scope.postMessage({ type: 'error', requestId, code: 'workbook_failed' });
  } finally {
    scope.close();
  }
};
