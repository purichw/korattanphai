import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminRequestError, createAdminClient } from '../src/admin/client';
import { useAdminRead } from '../src/admin/useAdminRead';
import { PageLoadBoundary } from '../src/components/PageLoadBoundary';
import { getSupabaseClient } from '../src/supabase';
import { authTestSession, authTestUser } from './fixtures/supabase.mjs';

vi.mock('../src/supabase', () => ({ getSupabaseClient: vi.fn() }));

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
};
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json' },
});
const oldList = { items: [{ id: 'draft-1', title: 'ฉบับเดิม' }], total: 1 };
const newList = { items: [{ id: 'draft-1', title: 'ฉบับล่าสุด' }], total: 1 };
type List = typeof oldList;
let session = authTestSession();
const getSession = vi.fn();
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  session = authTestSession();
  getSession.mockReset().mockImplementation(async () => ({ data: { session }, error: null }));
  vi.mocked(getSupabaseClient).mockResolvedValue({ auth: { getSession } } as never);
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function ReadProbe({ api }: { api: ReturnType<typeof createAdminClient> }) {
  const read = useAdminRead<List>(api, 'list', { offset: 0 });
  return <section>
    {read.data && <p>{read.data.items[0].title}</p>}
    {read.error && <p role="alert">{read.error}</p>}
    <p data-testid="refreshing">{String(read.refreshing)}</p>
    <button onClick={read.reload}>ลองใหม่</button>
  </section>;
}
const renderRead = (api: ReturnType<typeof createAdminClient>) => render(
  <PageLoadBoundary path="/admin"><ReadProbe api={api} /></PageLoadBoundary>,
);
const expectReady = async () => {
  await waitFor(() => expect(screen.getByTestId('refreshing')).toHaveTextContent('false'));
  expect(document.querySelector('.app-startup')).toBeNull();
};

describe('account-owned Admin read cache', () => {
  it('never shares successful reads with another workspace or account', async () => {
    const first = createAdminClient(authTestUser.id);
    fetchMock.mockResolvedValueOnce(response(oldList));
    await first('list', { offset: 0 });
    expect(first.cached('list', { offset: 0 })).toEqual(oldList);
    expect(createAdminClient(authTestUser.id).cached('list', { offset: 0 })).toBeUndefined();
    expect(createAdminClient('another-user').cached('list', { offset: 0 })).toBeUndefined();
    expect(first.cached('list', { offset: 50 })).toBeUndefined();
  });

  it('checks the session and server again for a warm read, using the current token', async () => {
    const api = createAdminClient(authTestUser.id);
    fetchMock.mockResolvedValueOnce(response(oldList)).mockResolvedValueOnce(response(newList));
    await api('list', { offset: 0 });
    session = { ...session, access_token: 'test-only-refreshed-token' };
    expect(await api('list', { offset: 0 })).toEqual(newList);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getSession).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ cache: 'no-store', headers: { Authorization: 'Bearer test-only-refreshed-token' } });
    expect(api.cached('list', { offset: 0 })).toEqual(newList);
  });

  it('rejects an account change during a read and clears all cached data', async () => {
    const api = createAdminClient(authTestUser.id);
    fetchMock.mockResolvedValueOnce(response(oldList));
    await api('list', { offset: 0 });
    const pending = deferred<Response>();
    fetchMock.mockReturnValueOnce(pending.promise);
    const read = api('get', { id: 'draft-2' });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    session = { ...session, user: { ...session.user, id: 'another-user' } };
    pending.resolve(response({ id: 'draft-2' }));
    await expect(read).rejects.toMatchObject({ code: 'sign_in_required' });
    expect(api.cached('list', { offset: 0 })).toBeUndefined();
    expect(api.cached('get', { id: 'draft-2' })).toBeUndefined();
  });

  it('invalidates reads at mutation start and completion, excluding late pre-mutation responses', async () => {
    const api = createAdminClient(authTestUser.id);
    fetchMock.mockResolvedValueOnce(response(oldList));
    await api('list', { offset: 0 });
    const lateRead = deferred<Response>();
    const mutation = deferred<Response>();
    fetchMock.mockReturnValueOnce(lateRead.promise).mockReturnValueOnce(mutation.promise);
    const stale = api('get', { id: 'draft-1' });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const save = api('edit', { id: 'draft-1', body: { revision: 1, payload: {} } });
    expect(api.cached('list', { offset: 0 })).toBeUndefined();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    mutation.resolve(response({ id: 'draft-1', revision: 2 }));
    await save;
    lateRead.resolve(response({ id: 'draft-1', revision: 1 }));
    await stale;
    expect(api.cached('get', { id: 'draft-1' })).toBeUndefined();
    expect(api.cached('list', { offset: 0 })).toBeUndefined();
    fetchMock.mockResolvedValueOnce(response(newList));
    await api('list', { offset: 0 });
    expect(api.cached('list', { offset: 0 })).toEqual(newList);
  });

  it('does not cache an aborted request even if its transport later resolves', async () => {
    const api = createAdminClient(authTestUser.id);
    const pending = deferred<Response>();
    fetchMock.mockReturnValueOnce(pending.promise);
    const controller = new AbortController();
    const read = api('list', { offset: 0, signal: controller.signal });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    controller.abort();
    pending.resolve(response(oldList));
    await expect(read).rejects.toMatchObject({ name: 'AbortError' });
    expect(api.cached('list', { offset: 0 })).toBeUndefined();
  });
});

describe('Admin reads keep ready content visible', () => {
  it('drops the previous API owner immediately and ignores its late response after an account change', async () => {
    const first = createAdminClient(authTestUser.id);
    fetchMock.mockResolvedValueOnce(response(oldList));
    await first('list', { offset: 0 });
    const previousRead = deferred<Response>();
    const nextRead = deferred<Response>();
    fetchMock.mockReturnValueOnce(previousRead.promise).mockReturnValueOnce(nextRead.promise);
    const view = renderRead(first);
    expect(screen.getByText('ฉบับเดิม')).toBeVisible();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    session = { ...session, user: { ...session.user, id: 'another-user' } };
    const next = createAdminClient(session.user.id);
    view.rerender(<PageLoadBoundary path="/admin"><ReadProbe api={next} /></PageLoadBoundary>);
    expect(screen.queryByText('ฉบับเดิม')).toBeNull();
    expect(document.querySelector('.app-startup')).toBeVisible();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    await act(async () => nextRead.resolve(response(newList)));
    await expectReady();
    expect(screen.getByText('ฉบับล่าสุด')).toBeVisible();

    await act(async () => previousRead.resolve(response(oldList)));
    expect(screen.queryByText('ฉบับเดิม')).toBeNull();
    expect(screen.getByText('ฉบับล่าสุด')).toBeVisible();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(next.cached('list', { offset: 0 })).toEqual(newList);
  });

  it('renders a warm result while revalidating without blocking PageLoadBoundary', async () => {
    const api = createAdminClient(authTestUser.id);
    fetchMock.mockResolvedValueOnce(response(oldList));
    await api('list', { offset: 0 });
    const pending = deferred<Response>();
    fetchMock.mockReturnValueOnce(pending.promise);
    renderRead(api);
    expect(screen.getByText('ฉบับเดิม')).toBeVisible();
    expect(screen.getByTestId('refreshing')).toHaveTextContent('true');
    expect(document.querySelector('.app-startup')).toBeNull();
    expect(document.querySelector('.page-load-content')).not.toHaveAttribute('aria-hidden');
    await act(async () => pending.resolve(response(newList)));
    await expectReady();
    expect(screen.getByText('ฉบับล่าสุด')).toBeVisible();
    expect(screen.queryByText('ฉบับเดิม')).toBeNull();
  });

  it('preserves visible data on a temporary refresh failure and permits another retry', async () => {
    const api = createAdminClient(authTestUser.id);
    fetchMock.mockResolvedValueOnce(response(oldList));
    await api('list', { offset: 0 });
    fetchMock.mockRejectedValueOnce(new TypeError('Network unavailable'));
    renderRead(api);
    await expectReady();
    expect(screen.getByText('ฉบับเดิม')).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('เชื่อมต่อ CMS ไม่สำเร็จ');
    const pending = deferred<Response>();
    fetchMock.mockReturnValueOnce(pending.promise);
    fireEvent.click(screen.getByRole('button', { name: 'ลองใหม่' }));
    expect(document.querySelector('.app-startup')).toBeNull();
    expect(screen.getByText('ฉบับเดิม')).toBeVisible();
    await act(async () => pending.resolve(response(newList)));
    await expectReady();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('ฉบับล่าสุด')).toBeVisible();
  });

  it.each(['sign_in_required', 'cms_forbidden', 'draft_not_found'])(
    'removes old content after the server denies the read (%s)', async code => {
      const api = createAdminClient(authTestUser.id);
      fetchMock.mockResolvedValueOnce(response(oldList));
      await api('list', { offset: 0 });
      const status = code === 'cms_forbidden' ? 403 : code === 'sign_in_required' ? 401 : 404;
      fetchMock.mockResolvedValueOnce(response({ error: { code } }, status));
      renderRead(api);
      await expectReady();
      expect(screen.queryByText('ฉบับเดิม')).toBeNull();
      expect(screen.getByRole('alert')).toHaveTextContent(new AdminRequestError(code).message);
      expect(api.cached('list', { offset: 0 })).toBeUndefined();
    },
  );

  it('releases the initial splash on failure and can retry the cold read', async () => {
    const api = createAdminClient(authTestUser.id);
    const first = deferred<Response>();
    fetchMock.mockReturnValueOnce(first.promise);
    renderRead(api);
    expect(document.querySelector('.app-startup')).toBeVisible();
    await act(async () => first.resolve(response({ error: { code: 'cms_unavailable' } }, 503)));
    await expectReady();
    expect(screen.getByRole('alert')).toBeVisible();
    const retry = deferred<Response>();
    fetchMock.mockReturnValueOnce(retry.promise);
    fireEvent.click(screen.getByRole('button', { name: 'ลองใหม่' }));
    expect(document.querySelector('.app-startup')).toBeVisible();
    await act(async () => retry.resolve(response(newList)));
    await expectReady();
    expect(screen.getByText('ฉบับล่าสุด')).toBeVisible();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
