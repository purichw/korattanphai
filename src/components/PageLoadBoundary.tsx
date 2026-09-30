import { createContext, type ReactNode, useCallback, useContext, useLayoutEffect, useState } from 'react';
import { AppStartup } from './AppStartup';

const PageLoadContext = createContext<(() => () => void) | null>(null);

/** Only blocking page reads participate. Cached refreshes and mutations stay local. */
export function usePageLoading(pending: boolean) {
  const begin = useContext(PageLoadContext);
  useLayoutEffect(() => {
    if (pending) return begin?.();
  }, [begin, pending]);
}

export function PageLoadPending() {
  usePageLoading(true);
  return null;
}

export function PageLoadBoundary({ path, children }: { path: string; children: ReactNode }) {
  const [tasks, setTasks] = useState<Set<symbol>>(() => new Set());
  const begin = useCallback(() => {
    const task = Symbol();
    setTasks(current => new Set(current).add(task));
    return () => setTasks(current => {
      const next = new Set(current);
      next.delete(task);
      return next;
    });
  }, []);
  const pending = tasks.size > 0;
  useLayoutEffect(() => {
    if (!pending) return;
    const overflow = document.body.style.overflow;
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      if (focused?.isConnected && focused !== document.body) focused.focus({ preventScroll: true });
    };
  }, [pending]);

  // Keep children mounted and measurable so nested data/map reads can finish.
  // Layout-effect registration covers waterfalls before the browser paints.
  return <PageLoadContext.Provider value={begin}>
    <div className="page-load-content" inert={pending} aria-hidden={pending || undefined}>{children}</div>
    {pending && <AppStartup path={path} />}
  </PageLoadContext.Provider>;
}
