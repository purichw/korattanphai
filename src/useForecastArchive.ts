import { useEffect, useState } from "react";
import { forecastArchiveLoader, forecastOverviewLoader } from "./data/forecastArchive";

export function useForecastArchive(enabled: boolean, source: "full" | "overview" = "full") {
  const loader = source === "overview" ? forecastOverviewLoader : forecastArchiveLoader;
  const [archive, setArchive] = useState(loader.getCached);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setFailed(false);
    // Share one request across routes; a departed view must not receive its result.
    loader.load().then(
      (data) => { if (active) setArchive(data); },
      () => { if (active) setFailed(true); },
    );
    return () => { active = false; };
  }, [enabled, attempt, loader]);

  return { archive, failed, retry: () => { setFailed(false); setAttempt((value) => value + 1); } };
}
