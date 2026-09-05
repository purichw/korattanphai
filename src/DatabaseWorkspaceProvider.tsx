import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { getSupabaseClient } from './supabase';
import { createSupabaseForecastLoader } from './data/supabaseForecastArchive';
import { createSavedWorkspaceClient } from './data/savedWorkspaces';

function createServices(userId: string) {
  return {
    userId,
    full: createSupabaseForecastLoader(userId, 6, getSupabaseClient),
    overview: createSupabaseForecastLoader(userId, 1, getSupabaseClient),
    saved: createSavedWorkspaceClient(userId, getSupabaseClient),
  };
}
const DatabaseWorkspaceContext = createContext<ReturnType<typeof createServices> | null>(null);
export const useDatabaseWorkspace = () => useContext(DatabaseWorkspaceContext);

export function DatabaseWorkspaceProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const services = useMemo(() => createServices(userId), [userId]);
  useEffect(() => {
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    void getSupabaseClient().then((client) => {
      if (!client || disposed) return;
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        if (session?.user.id !== userId) { services.full.clear(); services.overview.clear(); }
      });
      unsubscribe = () => data.subscription.unsubscribe();
    }).catch(() => { /* The archive loader reports connection failures in the page. */ });
    return () => { disposed = true; unsubscribe?.(); services.full.clear(); services.overview.clear(); };
  }, [services, userId]);
  return <DatabaseWorkspaceContext.Provider value={services}>{children}</DatabaseWorkspaceContext.Provider>;
}
