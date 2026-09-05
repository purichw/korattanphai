export type StorageIssue = "unavailable" | "invalid" | null;

const fallback = new Map<string, string | null>();
const listeners = new Set<() => void>();
let issue: StorageIssue = null;

export function reportStorageIssue(next: StorageIssue) {
  if (issue === next || (issue === "unavailable" && next === "invalid")) return;
  issue = next;
  // Reads may happen during React initialization; notify after the current render.
  queueMicrotask(() => listeners.forEach((listener) => listener()));
}

export function getStorageIssue() { return issue; }
export function subscribeStorageIssue(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function readBrowserStorage(key: string): string | null {
  if (fallback.has(key)) return fallback.get(key) ?? null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    reportStorageIssue("unavailable");
    return null;
  }
}

export function writeBrowserStorage(key: string, value: string | null): boolean {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
    fallback.delete(key);
    return true;
  } catch {
    // A failed logout must not resurrect a previously stored user in this document.
    fallback.set(key, value);
    reportStorageIssue("unavailable");
    return false;
  }
}
