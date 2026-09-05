import type { AppState, RuntimeState } from "./types";

type Validator = (value: unknown) => boolean;
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const string: Validator = (value) => typeof value === "string";
const count: Validator = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0;
const array = (check: Validator): Validator => (value) => Array.isArray(value) && value.every(check);
const record = (check: Validator): Validator => (value) => object(value) && Object.values(value).every(check);
const fields = (checks: Record<string, Validator>): Validator => (value) =>
  object(value) && Object.entries(checks).every(([key, check]) => check(value[key]));
const audit = fields({ at: string, action: string, actor: string });
const runtimeChecks: Record<keyof RuntimeState, Validator> = {
  taskStatus: record(string),
  taskSubmissions: record(fields(Object.fromEntries([
    "fieldCondition", "cropStage", "waterAvailability", "visibleStress", "farmerReportedIssues", "note", "photoState",
  ].map((key) => [key, string])))),
  eventConfidence: record((value) => ["Low", "Medium", "High"].includes(value as string)),
  eventStatus: record(string),
  eventAuditTrail: record(array(audit)),
  advisoryStatus: string,
  advisoryActions: array(string),
  advisoryVersionHistory: array(audit),
  selectedChannels: array((value) => ["Web portal", "Farmer app", "Push", "SMS"].includes(value as string)),
  deliveryRecords: array(fields({ channel: string, targeted: count, delivered: count, viewed: count, acknowledged: count })),
  farmerAlerts: array(fields({
    id: string, linkedAdvisoryId: string, linkedRiskEventId: string, title: string, createdAt: string,
    read: (value) => typeof value === "boolean",
  })),
};

// Accept older partial snapshots, but never spread unchecked values into runtime state.
export function decodePersistedState(raw: string | null, defaults: AppState): { state: AppState; invalid: boolean } {
  if (raw === null) return { state: defaults, invalid: false };
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return { state: defaults, invalid: true }; }
  if (!object(parsed)) return { state: defaults, invalid: true };
  const state = { ...defaults, runtime: { ...defaults.runtime } };
  let invalid = false;
  for (const key of Object.keys(defaults) as (keyof AppState)[]) {
    if (!(key in parsed) || key === "runtime" || key === "toast") continue;
    const value = parsed[key];
    const valid = key === "mapSelectedProvinceId" ? value === null || string(value)
      : key === "section" ? ["overview", "risks", "map", "forecast", "crops", "workflows", "alerts", "planning", "models"].includes(value as string)
      : key === "selectedMonth" ? typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
      : string(value);
    if (valid) Object.assign(state, { [key]: value });
    else invalid = true;
  }
  if ("runtime" in parsed) {
    if (!object(parsed.runtime)) invalid = true;
    else for (const key of Object.keys(runtimeChecks) as (keyof RuntimeState)[]) {
      if (!(key in parsed.runtime)) continue;
      if (runtimeChecks[key](parsed.runtime[key])) Object.assign(state.runtime, { [key]: parsed.runtime[key] });
      else invalid = true;
    }
  }
  state.language = "th";
  state.selectedHazard = "All";
  state.selectedCrop = "All";
  return { state, invalid };
}
