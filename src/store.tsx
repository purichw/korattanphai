import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import { readBrowserStorage, reportStorageIssue, writeBrowserStorage } from "./browserStorage";
import { decodePersistedState } from "./persistedState";
import { advisory, fieldTasks, users } from "./data/catalog";
import {
  buildDeliveryRecords,
  DEFAULT_MAP_LAYER_ID,
  FARM_ID,
  MAIN_ADVISORY_ID,
  MAIN_EVENT_ID,
  MAIN_TASK_ID,
  NAKHON_RATCHASIMA_ID,
  nowAudit,
  normalizeMapLayerId,
} from "./domain";
import type {
  AppSection,
  AppState,
  Language,
  RuntimeState,
  VerificationSubmission,
} from "./types";

const STORAGE_KEY = "korat-tan-phai-demo-state-v1";

const defaultChannels = ["Web portal", "Farmer app", "Push", "SMS"];

export function createInitialRuntimeState(): RuntimeState {
  return {
    taskStatus: Object.fromEntries(fieldTasks.map((task) => [task.id, task.status])),
    taskSubmissions: {},
    eventConfidence: {},
    eventStatus: {},
    eventAuditTrail: {},
    advisoryStatus: advisory.status,
    advisoryActions: [...advisory.actions],
    advisoryVersionHistory: [],
    selectedChannels: defaultChannels,
    deliveryRecords: [],
    farmerAlerts: [],
  };
}

export function createInitialState(): AppState {
  return {
    language: "th",
    personaId: "u-province",
    section: "overview",
    selectedMonth: "2026-08",
    selectedHazard: "All",
    selectedCrop: "All",
    selectedProvinceId: NAKHON_RATCHASIMA_ID,
    mapSelectedProvinceId: null,
    selectedLocationId: NAKHON_RATCHASIMA_ID,
    selectedEventId: MAIN_EVENT_ID,
    selectedTaskId: MAIN_TASK_ID,
    mapLayer: DEFAULT_MAP_LAYER_ID,
    runtime: createInitialRuntimeState(),
  };
}

function localizedToast(_language: Language, th: string, _en?: string) {
  return th;
}

type Action =
  | { type: "setLanguage"; language: Language }
  | { type: "setPersona"; personaId: string }
  | { type: "setSection"; section: AppSection }
  | { type: "setMonth"; month: string }
  | { type: "setHazard"; hazard: string }
  | { type: "setCrop"; crop: string }
  | { type: "selectProvince"; provinceId: string }
  | { type: "selectMapProvince"; provinceId: string }
  | { type: "selectLocation"; locationId: string }
  | { type: "selectEvent"; eventId: string; section?: AppSection }
  | { type: "selectTask"; taskId: string }
  | { type: "setMapLayer"; layer: AppState["mapLayer"] }
  | { type: "submitVerification"; submission: VerificationSubmission }
  | { type: "updateAdvisoryAction"; index: number; value: string }
  | { type: "submitAdvisoryForReview" }
  | { type: "approveAdvisory" }
  | { type: "requestChanges" }
  | { type: "toggleChannel"; channel: string }
  | { type: "publishAdvisory" }
  | { type: "markAlertRead"; alertId: string }
  | { type: "resetDemo" }
  | { type: "toast"; message?: string };

function addEventAudit(runtime: RuntimeState, eventId: string, action: string, actor: string) {
  return {
    ...runtime.eventAuditTrail,
    [eventId]: [...(runtime.eventAuditTrail[eventId] ?? []), nowAudit(action, actor)],
  };
}

export function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "setLanguage":
      return { ...state, language: "th", toast: "ตั้งค่าภาษาไทยเป็นภาษาหลักแล้ว" };
    case "setPersona": {
      const persona = users.find((user) => user.id === action.personaId);
      return {
        ...state,
        personaId: action.personaId,
        section: persona?.role === "Farmer" ? "alerts" : state.section,
        toast: persona ? "ปรับบทบาทการใช้งานแล้ว" : undefined,
      };
    }
    case "setSection":
      return { ...state, section: action.section };
    case "setMonth":
      return { ...state, selectedMonth: action.month };
    case "setHazard":
      return { ...state, selectedHazard: "All" };
    case "setCrop":
      return { ...state, selectedCrop: "All" };
    case "selectProvince":
      return {
        ...state,
        selectedProvinceId: action.provinceId,
        mapSelectedProvinceId: null,
        selectedLocationId: action.provinceId,
      };
    case "selectMapProvince":
      return {
        ...state,
        selectedProvinceId: action.provinceId,
        mapSelectedProvinceId: action.provinceId,
        selectedLocationId: action.provinceId,
      };
    case "selectLocation":
      return { ...state, selectedLocationId: action.locationId };
    case "selectEvent":
      return {
        ...state,
        selectedEventId: action.eventId,
        section: action.section ?? state.section,
      };
    case "selectTask":
      return { ...state, selectedTaskId: action.taskId, section: "workflows" };
    case "setMapLayer":
      return { ...state, mapLayer: action.layer };
    case "submitVerification":
      return {
        ...state,
        runtime: {
          ...state.runtime,
          taskStatus: { ...state.runtime.taskStatus, [MAIN_TASK_ID]: "Submitted" },
          taskSubmissions: { ...state.runtime.taskSubmissions, [MAIN_TASK_ID]: action.submission },
          eventConfidence: { ...state.runtime.eventConfidence, [MAIN_EVENT_ID]: "High" },
          eventStatus: { ...state.runtime.eventStatus, [MAIN_EVENT_ID]: "Verified / Advisory Ready" },
          eventAuditTrail: addEventAudit(
            state.runtime,
            MAIN_EVENT_ID,
            "Field verification submitted; event confidence increased",
            "เจ้าหน้าที่ส่งเสริมการเกษตร",
          ),
        },
        toast: localizedToast(state.language, "ส่งผลตรวจภาคสนามและอัปเดตเหตุการณ์แล้ว", "Field verification submitted and event updated"),
      };
    case "updateAdvisoryAction": {
      const actions = [...state.runtime.advisoryActions];
      actions[action.index] = action.value;
      return {
        ...state,
        runtime: {
          ...state.runtime,
          advisoryActions: actions,
          advisoryVersionHistory: [
            ...state.runtime.advisoryVersionHistory,
            nowAudit("Advisory recommendation edited", "เจ้าหน้าที่เกษตรจังหวัด"),
          ],
        },
      };
    }
    case "submitAdvisoryForReview":
      return {
        ...state,
        runtime: {
          ...state.runtime,
          advisoryStatus: "Ready for Review",
          eventAuditTrail: addEventAudit(state.runtime, MAIN_EVENT_ID, "Advisory submitted for supervisor review", "เจ้าหน้าที่เกษตรจังหวัด"),
        },
        toast: localizedToast(state.language, "ส่งคำแนะนำเข้าสู่คิวตรวจอนุมัติแล้ว", "Advisory sent to supervisor review queue"),
      };
    case "approveAdvisory":
      return {
        ...state,
        runtime: {
          ...state.runtime,
          advisoryStatus: "Approved",
          eventAuditTrail: addEventAudit(state.runtime, MAIN_EVENT_ID, "Advisory approved", "ผู้ตรวจอนุมัติ"),
        },
        toast: localizedToast(state.language, "อนุมัติคำแนะนำแล้ว พร้อมเผยแพร่", "Advisory approved; publication enabled"),
      };
    case "requestChanges":
      return {
        ...state,
        runtime: {
          ...state.runtime,
          advisoryStatus: "Changes Requested",
          eventAuditTrail: addEventAudit(state.runtime, MAIN_EVENT_ID, "Supervisor requested advisory changes", "ผู้ตรวจอนุมัติ"),
        },
        toast: localizedToast(state.language, "ส่งกลับให้ผู้จัดทำแก้ไขคำแนะนำแล้ว", "Changes requested and returned to advisory author"),
      };
    case "toggleChannel": {
      const selectedChannels = state.runtime.selectedChannels.includes(action.channel)
        ? state.runtime.selectedChannels.filter((channel) => channel !== action.channel)
        : [...state.runtime.selectedChannels, action.channel];
      return {
        ...state,
        runtime: { ...state.runtime, selectedChannels },
      };
    }
    case "publishAdvisory": {
      const records = buildDeliveryRecords(state.runtime.selectedChannels);
      const farmerAlert = {
        id: `ALERT-${MAIN_ADVISORY_ID}`,
        linkedAdvisoryId: MAIN_ADVISORY_ID,
        linkedRiskEventId: MAIN_EVENT_ID,
        title: "คำแนะนำจัดการน้ำในนาข้าวฝนทิ้งช่วง",
        createdAt: new Date().toISOString(),
        read: false,
      };
      return {
        ...state,
        runtime: {
          ...state.runtime,
          advisoryStatus: "Published",
          deliveryRecords: records,
          farmerAlerts: [farmerAlert],
          eventStatus: { ...state.runtime.eventStatus, [MAIN_EVENT_ID]: "Published / Monitoring" },
          eventAuditTrail: addEventAudit(state.runtime, MAIN_EVENT_ID, "Advisory published to selected channels", "เจ้าหน้าที่เกษตรระดับประเทศ"),
        },
        toast: localizedToast(state.language, "เผยแพร่แล้ว และสร้างคำเตือนสำหรับ FARM-001", "Published; farmer alert created for FARM-001"),
      };
    }
    case "markAlertRead":
      return {
        ...state,
        runtime: {
          ...state.runtime,
          farmerAlerts: state.runtime.farmerAlerts.map((alert) =>
            alert.id === action.alertId ? { ...alert, read: true } : alert,
          ),
        },
      };
    case "resetDemo":
      return { ...createInitialState(), toast: localizedToast(state.language, "คืนค่าข้อมูลเริ่มต้นแล้ว", "Data reset") };
    case "toast":
      return { ...state, toast: action.message };
    default:
      return state;
  }
}

export function loadInitialState(): AppState {
  if (typeof window === "undefined") return createInitialState();
  const { state, invalid } = decodePersistedState(readBrowserStorage(STORAGE_KEY), createInitialState());
  if (invalid) reportStorageIssue("invalid");
  if (!users.some((user) => user.id === state.personaId)) state.personaId = "u-province";
  state.mapLayer = normalizeMapLayerId(state.mapLayer);
  return state;
}

const AppStateContext = createContext<AppState | null>(null);
const AppDispatchContext = createContext<React.Dispatch<Action> | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, undefined, loadInitialState);
  const lastPersistedState = useRef(state);

  useEffect(() => {
    // Preserve the original snapshot on mount, including malformed data for recovery.
    if (lastPersistedState.current === state) return;
    lastPersistedState.current = state;
    const { toast: _toast, ...persisted } = state;
    writeBrowserStorage(STORAGE_KEY, JSON.stringify(persisted));
  }, [state]);

  const memoState = useMemo(() => state, [state]);

  return (
    <AppStateContext.Provider value={memoState}>
      <AppDispatchContext.Provider value={dispatch}>{children}</AppDispatchContext.Provider>
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const state = useContext(AppStateContext);
  if (!state) throw new Error("useAppState must be used inside AppStateProvider");
  return state;
}

export function useAppDispatch() {
  const dispatch = useContext(AppDispatchContext);
  if (!dispatch) throw new Error("useAppDispatch must be used inside AppStateProvider");
  return dispatch;
}
