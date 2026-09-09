export const CRITICAL_LOAD_TIMEOUT_MS = 30_000;

export class LoadTimeoutError extends Error {
  constructor() { super('Load timed out'); this.name = 'LoadTimeoutError'; }
}

/** Bound the entire operation, including SDK/session and JSON-body promises that ignore abort. */
export function withLoadDeadline<T>(controller: AbortController, operation: () => Promise<T>, timeoutMs = CRITICAL_LOAD_TIMEOUT_MS): Promise<T> {
  let rejectAbort!: (reason: Error) => void;
  const aborted = new Promise<never>((_resolve, reject) => { rejectAbort = reject; });
  const onAbort = () => rejectAbort(controller.signal.reason instanceof Error ? controller.signal.reason : new Error('Session changed'));
  controller.signal.addEventListener('abort', onAbort, { once: true });
  if (controller.signal.aborted) onAbort();
  const timer = setTimeout(() => controller.abort(new LoadTimeoutError()), timeoutMs);
  const task = Promise.resolve().then(() => {
    if (controller.signal.aborted) throw controller.signal.reason;
    return operation();
  });
  return Promise.race([task, aborted]).finally(() => {
    clearTimeout(timer);
    controller.signal.removeEventListener('abort', onAbort);
  });
}
