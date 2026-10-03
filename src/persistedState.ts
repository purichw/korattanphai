import type { AppState } from "./types";

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

// Older snapshots may contain retired demo workflows. Only current
// preferences are accepted; no unchecked fields are spread into app state.
export function decodePersistedState(raw: string | null, defaults: AppState): { state: AppState; invalid: boolean } {
  if (raw === null) return { state: defaults, invalid: false };
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return { state: defaults, invalid: true }; }
  if (!object(parsed)) return { state: defaults, invalid: true };
  const state = { ...defaults };
  let invalid = false;
  if ("language" in parsed && parsed.language !== "th" && parsed.language !== "en") invalid = true;
  if ("selectedMonth" in parsed) {
    if (typeof parsed.selectedMonth === "string" && (parsed.selectedMonth === "" || /^\d{4}-(0[1-9]|1[0-2])$/.test(parsed.selectedMonth))) {
      state.selectedMonth = parsed.selectedMonth;
    } else invalid = true;
  }
  state.language = "th";
  return { state, invalid };
}
