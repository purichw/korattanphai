import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { createSupabaseForecastLoader } from '../../../src/data/supabaseForecastArchive';
import { backend } from './backend';
import type { Archive } from './domain';

export function useForecast(userId: string, areaCode: string, origin: string) {
  const loader = useMemo(() => createSupabaseForecastLoader(userId, 6, async () => backend), [userId]);
  const key = `${areaCode}|${origin}`;
  const [state, setState] = useState<{ key: string; archive: Archive | null; loading: boolean; error: boolean; checked: Date | null }>({ key, archive: null, loading: true, error: false, checked: null });
  const generation = useRef(0);
  const mounted = useRef(true);
  const refresh = useCallback(async () => {
    const id = ++generation.current;
    setState(old => ({ key, archive: old.key === key ? old.archive : null, loading: true, error: false, checked: old.key === key ? old.checked : null }));
    try {
      const archive = await loader.load({ areaCode, originPeriod: origin || null });
      if (mounted.current && id === generation.current) setState({ key, archive, loading: false, error: false, checked: new Date() });
    } catch {
      if (mounted.current && id === generation.current) setState(old => ({ ...old, loading: false, error: true }));
    }
  }, [loader, key, areaCode, origin]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current++; loader.clear(); }; }, [loader]);
  useEffect(() => { void refresh(); return () => { generation.current++; }; }, [refresh]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', status => { if (status === 'active') void refresh(); });
    return () => subscription.remove();
  }, [refresh]);
  return { ...state, archive: state.key === key ? state.archive : null, loading: state.key !== key || state.loading, refresh, loader };
}
