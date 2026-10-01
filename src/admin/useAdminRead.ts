import { useEffect, useState } from 'react';
import { usePageLoading } from '../components/PageLoadBoundary';
import { AdminRequestError, adminReadKey, type AdminReadOptions, type createAdminClient } from './client';

type AdminClient = ReturnType<typeof createAdminClient>;
type ReadState<T> = { api: AdminClient; key: string; data: T | undefined; error: string; pending: boolean };

// Revalidate on entry/retry, keeping successful reads visible. Session events
// alone do not trigger requests or replace an operator's unsaved form.
export function useAdminRead<T>(api: AdminClient, action: string, options: AdminReadOptions = {}, refreshVersion = 0) {
  const key = adminReadKey(action, options);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<ReadState<T>>(() => ({ api, key, data: api.cached<T>(action, options), error: '', pending: true }));
  const current = state.api === api && state.key === key ? state : { api, key, data: api.cached<T>(action, options), error: '', pending: true };
  const loading = current.pending && current.data === undefined;
  usePageLoading(loading);

  useEffect(() => {
    const controller = new AbortController();
    const [readAction, id, offset, body] = JSON.parse(key);
    const readOptions = { ...(id === null ? {} : { id }), ...(offset === null ? {} : { offset }), ...(body === null ? {} : { body }) };
    setState(previous => ({ api, key, data: previous.api === api && previous.key === key ? previous.data : api.cached<T>(readAction, readOptions), error: '', pending: true }));
    void api<T>(readAction, { ...readOptions, signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setState({ api, key, data, error: '', pending: false });
    }).catch(failure => {
      if (controller.signal.aborted) return;
      const denied = failure instanceof AdminRequestError && ['sign_in_required', 'cms_forbidden', 'draft_not_found'].includes(failure.code);
      setState(previous => ({ api, key, data: denied ? undefined : previous.data,
        error: failure instanceof Error ? failure.message : 'โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่', pending: false }));
    });
    return () => controller.abort();
  }, [api, key, attempt, refreshVersion]);

  return { data: current.data, error: current.error, loading, refreshing: current.pending,
    reload: () => setAttempt(value => value + 1),
    setData: (data: T) => setState(previous => previous.api === api && previous.key === key ? { ...previous, data } : previous),
  };
}
