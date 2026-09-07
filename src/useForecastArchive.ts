import { useEffect, useState } from "react";
import type { NakhonRatchasimaDroughtForecastArchive } from "./types";
import { forecastArchiveLoader, forecastOverviewLoader } from "./data/forecastArchive";
import { useDatabaseWorkspace } from "./DatabaseWorkspaceProvider";

export function useForecastArchive(enabled: boolean, source: "full" | "overview" = "full", areaCode = "30") {
  const database = useDatabaseWorkspace();
  if (import.meta.env.VITE_DATA_BACKEND === "supabase" && !database) throw new Error("Database workspace provider unavailable");
  const loader = database ? database[source] : source === "overview" ? forecastOverviewLoader : forecastArchiveLoader;
  const routeKey = `${window.location.pathname}|${source}|${areaCode}`;
  const [selection, setSelection] = useState(() => ({ routeKey, originPeriod: new URLSearchParams(window.location.search).get("target") }));
  // The workspace survives navigation; discard its previous route's query before loading.
  const currentSelection = selection.routeKey === routeKey ? selection
    : { routeKey, originPeriod: new URLSearchParams(window.location.search).get("target") };
  if (currentSelection !== selection) setSelection(currentSelection);
  const { originPeriod } = currentSelection;
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${areaCode}|${originPeriod ?? ""}|${attempt}`;
  const query = { areaCode, originPeriod };
  const [result, setResult] = useState(() => ({ loader, areaCode, key: "", failed: false,
    archive: loader.getCached(query) as NakhonRatchasimaDroughtForecastArchive | null }));
  const sameScope = result.loader === loader && result.areaCode === areaCode;
  const archive = sameScope ? result.archive : loader.getCached(query);
  const pending = enabled && (!sameScope || result.key !== requestKey);
  const failed = enabled && !pending && sameScope && result.failed;

  useEffect(() => {
    if (!enabled || !database) return;
    const refresh = () => { if (document.visibilityState === 'visible') setAttempt(value => value + 1); };
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [enabled, database]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    // Share one request across routes; a departed view must not receive its result.
    loader.load({ areaCode, originPeriod }).then(
      (data) => { if (active) setResult({ loader, areaCode, key: requestKey, archive: data, failed: false }); },
      () => { if (active) setResult((previous) => ({ loader, areaCode, key: requestKey, failed: true,
        archive: previous.loader === loader && previous.areaCode === areaCode ? previous.archive : null })); },
    );
    return () => { active = false; };
  }, [enabled, requestKey, areaCode, originPeriod, loader]);

  const changingPeriod = pending && Boolean(archive?.loadedSelection && originPeriod && archive.loadedSelection.originPeriod !== originPeriod);
  return { archive, failed, pending, changingPeriod, retry: () => setAttempt((value) => value + 1),
    requestPeriod: database ? (period: string) => setSelection({ routeKey, originPeriod: period }) : undefined };
}
