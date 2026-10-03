import React, { createContext, useContext, useEffect, useReducer, useRef } from "react";
import { readBrowserStorage, reportStorageIssue, writeBrowserStorage } from "./browserStorage";
import { decodePersistedState } from "./persistedState";
import type { AppState, Language } from "./types";

const STORAGE_KEY = "korat-tan-phai-preferences-v1";
const PREVIOUS_STORAGE_KEY = "korat-tan-phai-demo-state-v1";

export function createInitialState(): AppState {
  // The published forecast archive owns the initial period. An empty preference
  // must not invent a forecast month before that archive has loaded.
  return { language: "th", selectedMonth: "" };
}

type Action =
  | { type: "setLanguage"; language: Language }
  | { type: "setMonth"; month: string }
  | { type: "toast"; message?: string };

export function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "setLanguage":
      return { ...state, language: "th", toast: "ตั้งค่าภาษาไทยเป็นภาษาหลักแล้ว" };
    case "setMonth":
      return { ...state, selectedMonth: action.month };
    case "toast":
      return { ...state, toast: action.message };
    default:
      return state;
  }
}

export function loadInitialState(): AppState {
  if (typeof window === "undefined") return createInitialState();
  // Read only supported preferences from previous versions. Do not delete or
  // overwrite their snapshot, including malformed content useful for recovery.
  const raw = readBrowserStorage(STORAGE_KEY) ?? readBrowserStorage(PREVIOUS_STORAGE_KEY);
  const { state, invalid } = decodePersistedState(raw, createInitialState());
  if (invalid) reportStorageIssue("invalid");
  return state;
}

const AppStateContext = createContext<AppState | null>(null);
const AppDispatchContext = createContext<React.Dispatch<Action> | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, undefined, loadInitialState);
  const lastPersistedState = useRef(state);

  useEffect(() => {
    if (lastPersistedState.current === state) return;
    const previous = lastPersistedState.current;
    lastPersistedState.current = state;
    // Transient notices are not preferences and should not replace a stored
    // snapshot when the user has not changed any persistent setting.
    if (previous.language === state.language && previous.selectedMonth === state.selectedMonth) return;
    writeBrowserStorage(STORAGE_KEY, JSON.stringify({ language: state.language, selectedMonth: state.selectedMonth }));
  }, [state]);

  return (
    <AppStateContext.Provider value={state}>
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
