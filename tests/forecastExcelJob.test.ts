import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ForecastExport } from '../src/forecastExportModel';
import { createForecastWorkbookJob, FORECAST_EXCEL_TIMEOUT_MS, type ForecastExcelWorkerRequest } from '../src/forecastExcelJob';

vi.mock('../src/forecastExcelWriter', () => ({ createForecastWorkbook: vi.fn() }));

class FakeWorker extends EventTarget {
  static instances: FakeWorker[] = [];
  static failPost = false;
  url: URL;
  options: WorkerOptions;
  postMessage = vi.fn<(value: ForecastExcelWorkerRequest) => void>(() => { if (FakeWorker.failPost) throw new DOMException('Cannot clone', 'DataCloneError'); });
  terminate = vi.fn();
  constructor(url: URL, options: WorkerOptions) {
    super(); this.url = url; this.options = options; FakeWorker.instances.push(this);
  }
  get request() { return this.postMessage.mock.calls[0][0]; }
  receive(value: Record<string, unknown>) { this.dispatchEvent(new MessageEvent('message', { data: { requestId: this.request.requestId, ...value } })); }
}
const report = { exportedAt: new Date('2026-09-09T00:00:00Z'), filename: 'report.xlsx' } as ForecastExport;
const lastWorker = () => FakeWorker.instances.at(-1)!;

beforeEach(() => {
  vi.useFakeTimers();
  FakeWorker.instances = [];
  FakeWorker.failPost = false;
  vi.stubGlobal('Worker', FakeWorker);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('cancellable Excel worker jobs', () => {
  it('creates a lazy module worker, forwards stages and receives one complete ArrayBuffer', async () => {
    const onProgress = vi.fn();
    const result = createForecastWorkbookJob(report, { onProgress });
    const worker = lastWorker();
    expect(worker.options).toEqual({ type: 'module', name: 'forecast-excel' });
    expect(worker.url.pathname).toContain('forecastExcelWorker.ts');
    expect(worker.request.report).toBe(report);
    worker.receive({ type: 'progress', stage: 'template' });
    worker.receive({ type: 'progress', stage: 'workbook' });
    worker.receive({ type: 'progress', stage: 'packaging' });
    const buffer = new Uint8Array([80, 75, 3, 4]).buffer;
    worker.receive({ type: 'complete', buffer });
    expect(await result).toBe(buffer);
    expect(onProgress.mock.calls).toEqual([['template'], ['workbook'], ['packaging']]);
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does no work for an already-aborted signal', async () => {
    const controller = new AbortController(); controller.abort();
    await expect(createForecastWorkbookJob(report, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(FakeWorker.instances).toHaveLength(0);
  });

  it('cancels CPU-bound work by terminating the worker and ignores late progress/results', async () => {
    const controller = new AbortController(), onProgress = vi.fn();
    const promise = createForecastWorkbookJob(report, { signal: controller.signal, onProgress });
    const rejection = expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    const worker = lastWorker(); controller.abort();
    worker.receive({ type: 'progress', stage: 'packaging' });
    worker.receive({ type: 'complete', buffer: new ArrayBuffer(4) });
    await rejection;
    expect(onProgress).not.toHaveBeenCalled();
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('times out an unresponsive worker and allows a clean retry in a new worker', async () => {
    const first = createForecastWorkbookJob(report);
    const rejection = expect(first).rejects.toMatchObject({ name: 'TimeoutError' });
    const expired = lastWorker();
    await vi.advanceTimersByTimeAsync(FORECAST_EXCEL_TIMEOUT_MS);
    await rejection;
    expect(expired.terminate).toHaveBeenCalledTimes(1);
    const retry = createForecastWorkbookJob(report, { timeoutMs: 1000 });
    const current = lastWorker(); expect(current).not.toBe(expired);
    expired.receive({ type: 'complete', buffer: new ArrayBuffer(4) });
    current.receive({ type: 'complete', buffer: new ArrayBuffer(8) });
    expect((await retry).byteLength).toBe(8);
    expect(current.terminate).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cleans up when serialization, worker execution or result decoding fails', async () => {
    FakeWorker.failPost = true;
    await expect(createForecastWorkbookJob(report)).rejects.toThrow('send the report');
    expect(lastWorker().terminate).toHaveBeenCalledTimes(1);
    FakeWorker.failPost = false;
    for (const event of [new ErrorEvent('error', { message: 'private implementation detail', cancelable: true }), new MessageEvent('messageerror')]) {
      const promise = createForecastWorkbookJob(report);
      const rejection = expect(promise).rejects.toThrow(/worker failed|receive the Excel/);
      const worker = lastWorker(); worker.dispatchEvent(event); await rejection;
      expect(worker.terminate).toHaveBeenCalledTimes(1);
    }
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects invalid completion payloads and worker-reported failure without exposing raw errors', async () => {
    for (const message of [{ type: 'complete', buffer: new ArrayBuffer(0) }, { type: 'complete', buffer: 'not a workbook' }, { type: 'error', code: 'workbook_failed', detail: 'private data' }]) {
      const promise = createForecastWorkbookJob(report);
      const rejection = expect(promise).rejects.toThrow('did not produce a complete workbook');
      const worker = lastWorker(); worker.receive(message); await rejection;
      expect(worker.terminate).toHaveBeenCalledTimes(1);
    }
  });

  it('ignores foreign request IDs and survives a progress renderer throwing', async () => {
    const onProgress = vi.fn(() => { throw new Error('UI callback'); });
    const promise = createForecastWorkbookJob(report, { onProgress });
    const worker = lastWorker();
    worker.receive({ type: 'complete', requestId: worker.request.requestId + 10, buffer: new ArrayBuffer(4) });
    expect(worker.terminate).not.toHaveBeenCalled();
    worker.receive({ type: 'progress', stage: 'workbook' });
    worker.receive({ type: 'progress', stage: 'invented-stage' });
    worker.receive({ type: 'complete', buffer: new ArrayBuffer(4) });
    expect((await promise).byteLength).toBe(4);
    expect(onProgress).toHaveBeenCalledTimes(1);
  });

  it('settlement removes the abort listener so abort after success cannot affect another export', async () => {
    const controller = new AbortController();
    const first = createForecastWorkbookJob(report, { signal: controller.signal });
    const completed = lastWorker(); completed.receive({ type: 'complete', buffer: new ArrayBuffer(4) }); await first;
    const second = createForecastWorkbookJob(report); const active = lastWorker(); controller.abort();
    expect(completed.terminate).toHaveBeenCalledTimes(1); expect(active.terminate).not.toHaveBeenCalled();
    active.receive({ type: 'complete', buffer: new ArrayBuffer(4) }); await second;
  });

  it('rejects unsupported workers and invalid timeout options without starting background work', async () => {
    for (const timeoutMs of [0, -1, 180001, Infinity, NaN, 0.5]) await expect(createForecastWorkbookJob(report, { timeoutMs })).rejects.toBeInstanceOf(RangeError);
    expect(FakeWorker.instances).toHaveLength(0);
    vi.stubGlobal('Worker', undefined);
    await expect(createForecastWorkbookJob(report)).rejects.toMatchObject({ name: 'NotSupportedError' });
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('worker transfer protocol', () => {
  it('transfers only the workbook view bytes and closes after forwarding writer progress', async () => {
    vi.resetModules();
    const postMessage = vi.fn(), close = vi.fn();
    vi.stubGlobal('postMessage', postMessage); vi.stubGlobal('close', close); vi.stubGlobal('onmessage', null);
    const { createForecastWorkbook } = await import('../src/forecastExcelWriter');
    vi.mocked(createForecastWorkbook).mockImplementation(async (_report, _template, options) => {
      options?.onProgress?.('template'); options?.onProgress?.('workbook'); options?.onProgress?.('packaging');
      return new Uint8Array([99, 80, 75, 3, 4, 88]).subarray(1, 5);
    });
    await import('../src/forecastExcelWorker');
    const handle = globalThis.onmessage as unknown as (event: MessageEvent) => Promise<void>;
    await handle(new MessageEvent('message', { data: { type: 'start', requestId: 7, report } }));
    expect(postMessage.mock.calls.slice(0, 3).map(([message]) => message.stage)).toEqual(['template', 'workbook', 'packaging']);
    const [message, transfers] = postMessage.mock.calls.at(-1)!;
    expect(message.type).toBe('complete'); expect(message.requestId).toBe(7);
    expect([...new Uint8Array(message.buffer)]).toEqual([80, 75, 3, 4]);
    expect(transfers).toEqual([message.buffer]); expect(close).toHaveBeenCalledTimes(1);
    await handle(new MessageEvent('message', { data: { type: 'start', requestId: 8, report } }));
    expect(postMessage).toHaveBeenCalledTimes(4);
  });

  it('reports a fixed failure code and closes when workbook generation throws', async () => {
    vi.resetModules();
    const postMessage = vi.fn(), close = vi.fn();
    vi.stubGlobal('postMessage', postMessage); vi.stubGlobal('close', close); vi.stubGlobal('onmessage', null);
    const { createForecastWorkbook } = await import('../src/forecastExcelWriter');
    vi.mocked(createForecastWorkbook).mockRejectedValue(new Error('private workbook data'));
    await import('../src/forecastExcelWorker');
    const handle = globalThis.onmessage as unknown as (event: MessageEvent) => Promise<void>;
    await handle(new MessageEvent('message', { data: { type: 'start', requestId: 9, report } }));
    expect(postMessage).toHaveBeenCalledExactlyOnceWith({ type: 'error', requestId: 9, code: 'workbook_failed' });
    expect(close).toHaveBeenCalledTimes(1);
  });
});
