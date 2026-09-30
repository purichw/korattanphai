import { useEffect, useLayoutEffect } from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceAccessBoundary, WorkspaceAccessProvider, useWorkspaceAccess, type WorkspaceAccessState } from '../src/access/WorkspaceAccessProvider';
import { workspaceAccessRequest } from '../src/access/workspaceAccess';
import { evaluateAccess, type AccessRequest } from '../src/access/policy';

const userId = '11111111-1111-4111-8111-111111111111';
const ownDistrict: AccessRequest = { capability: 'forecast.view', area: { level: 'district', code: '3008' } };
const ready = (): Extract<WorkspaceAccessState, { status: 'ready' }> => ({
  status: 'ready',
  policy: { version: 1, revision: 'policy-1', roles: [{ id: 'district_reader', label: { th: 'เจ้าหน้าที่อำเภอ', en: 'District officer' },
    rules: [{ capability: 'forecast.view', levels: ['district', 'subdistrict'] }] }] },
  assignment: { userId, revision: 'assignment-1', grants: [{ id: 'grant-1', roleId: 'district_reader',
    area: { level: 'district', code: '3008' }, enabled: true, expiresAt: null }] },
});
afterEach(() => vi.useRealTimers());

describe('workspace UI eligibility foundation', () => {
  it('does not mount protected consumers without a provider or during loading/error', () => {
    const mount = vi.fn();
    const Content = () => { useEffect(mount, []); return <p>Data consumer</p>; };
    const content = <WorkspaceAccessBoundary request={ownDistrict} fallback={<p>Unavailable</p>}><Content /></WorkspaceAccessBoundary>;
    const view = render(content);
    expect(screen.getByText('Unavailable')).toBeVisible();
    for (const status of ['loading', 'error'] as const) {
      view.rerender(<WorkspaceAccessProvider userId={userId} state={{ status }}>{content}</WorkspaceAccessProvider>);
      expect(screen.getByText('Unavailable')).toBeVisible();
    }
    expect(mount).not.toHaveBeenCalled();
  });

  it('keeps existing accounts explicitly compatible without granting CMS operations', () => {
    function Consumer() {
      const access = useWorkspaceAccess();
      return <p>{access.status}:{String(access.can({ ...ownDistrict, capability: 'forecast.export' }))}:
        {String(access.can({ ...ownDistrict, capability: 'cms.publish' as never }))}</p>;
    }
    render(<WorkspaceAccessProvider userId={userId} state={{ status: 'compatibility' }}><Consumer /></WorkspaceAccessProvider>);
    expect(screen.getByText('compatibility:true:false')).toBeVisible();
  });

  it('does not fall back to compatibility for unassigned or mismatched accounts', () => {
    const state = ready();
    const child = <WorkspaceAccessBoundary request={ownDistrict} fallback={<p>Denied</p>}><p>Allowed</p></WorkspaceAccessBoundary>;
    const view = render(<WorkspaceAccessProvider userId={userId} state={state}>{child}</WorkspaceAccessProvider>);
    expect(screen.getByText('Allowed')).toBeVisible();
    view.rerender(<WorkspaceAccessProvider userId="22222222-2222-4222-8222-222222222222" state={state}>{child}</WorkspaceAccessProvider>);
    expect(screen.getByText('Denied')).toBeVisible();
    view.rerender(<WorkspaceAccessProvider userId={userId} state={{ ...state, assignment: { ...state.assignment, grants: [] } }}>{child}</WorkspaceAccessProvider>);
    expect(screen.getByText('Denied')).toBeVisible();
  });

  it('unmounts component-owned resources on policy/assignment revisions and account replacement', () => {
    const dispose = vi.fn();
    function Consumer() { useEffect(() => dispose, []); return <p>Mounted</p>; }
    const state = ready();
    const view = render(<WorkspaceAccessProvider userId={userId} state={state}><Consumer /></WorkspaceAccessProvider>);
    view.rerender(<WorkspaceAccessProvider userId={userId} state={{ ...state, policy: { ...state.policy, revision: 'policy-2' } }}><Consumer /></WorkspaceAccessProvider>);
    expect(dispose).toHaveBeenCalledTimes(1);
    view.rerender(<WorkspaceAccessProvider userId={userId} state={{ ...state, assignment: { ...state.assignment, revision: 'assignment-2' } }}><Consumer /></WorkspaceAccessProvider>);
    expect(dispose).toHaveBeenCalledTimes(2);
    view.rerender(<WorkspaceAccessProvider userId="22222222-2222-4222-8222-222222222222" state={state}><Consumer /></WorkspaceAccessProvider>);
    expect(dispose).toHaveBeenCalledTimes(3);
  });

  it('removes mounted eligible content when a grant expires, without navigation', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-30T05:00:00.000Z'));
    const state = ready();
    state.assignment.grants[0].expiresAt = '2026-09-30T05:00:01.000Z';
    const dispose = vi.fn();
    function Content() { useEffect(() => dispose, []); return <p>Allowed</p>; }
    render(<WorkspaceAccessProvider userId={userId} state={state}>
      <WorkspaceAccessBoundary request={ownDistrict} fallback={<p>Denied</p>}><Content /></WorkspaceAccessBoundary>
    </WorkspaceAccessProvider>);
    expect(screen.getByText('Allowed')).toBeVisible();
    act(() => { vi.advanceTimersByTime(1_001); });
    expect(screen.getByText('Denied')).toBeVisible();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('invalidates revisions that would collide if joined by a delimiter', () => {
    const dispose = vi.fn();
    function Consumer() { useEffect(() => dispose, []); return <p>Mounted</p>; }
    const state = ready();
    state.policy.revision = 'p:a'; state.assignment.revision = 'b';
    const view = render(<WorkspaceAccessProvider userId={userId} state={state}><Consumer /></WorkspaceAccessProvider>);
    view.rerender(<WorkspaceAccessProvider userId={userId} state={{ ...state,
      policy: { ...state.policy, revision: 'p' }, assignment: { ...state.assignment, revision: 'a:b' },
    }}><Consumer /></WorkspaceAccessProvider>);
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('handles an expiry that crosses between render and the provider effect', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-30T05:00:00.000Z'));
    const state = ready();
    state.assignment.grants[0].expiresAt = '2026-09-30T05:00:01.000Z';
    function Content() {
      useLayoutEffect(() => { vi.setSystemTime(new Date('2026-09-30T05:00:02.000Z')); }, []);
      return <p>Allowed</p>;
    }
    render(<WorkspaceAccessProvider userId={userId} state={state}>
      <WorkspaceAccessBoundary request={ownDistrict} fallback={<p>Denied</p>}><Content /></WorkspaceAccessBoundary>
    </WorkspaceAccessProvider>);
    act(() => { vi.advanceTimersByTime(1); });
    expect(screen.getByText('Denied')).toBeVisible();
  });

  it('denies malformed ready snapshots without crashing or mounting data consumers', () => {
    const state = ready();
    render(<WorkspaceAccessProvider userId={userId} state={{ ...state, assignment: null as never }}>
      <WorkspaceAccessBoundary request={ownDistrict} fallback={<p>Denied</p>}><p>Allowed</p></WorkspaceAccessBoundary>
    </WorkspaceAccessProvider>);
    expect(screen.getByText('Denied')).toBeVisible();
    expect(screen.queryByText('Allowed')).toBeNull();
  });
});

describe('canonical route adapter', () => {
  it.each(['/dan-khun-thot/t-300806', '/nakhon-ratchasima/dan-khun-thot/t-300806?target=2025-12&horizon=4#forecast'])('uses the same administrative identity for %s', path => {
    expect(workspaceAccessRequest(path)).toEqual({ capability: 'forecast.view', area: { level: 'subdistrict', code: '300806' } });
  });

  it('does not let a query filter disguise a province page as a permitted district', () => {
    const province = workspaceAccessRequest('/?district=3008&target=2025-12&horizon=1')!;
    const state = ready();
    expect(province.area).toEqual({ level: 'province', code: '30' });
    expect(evaluateAccess({ userId, ...state, request: province }).allowed).toBe(false);
    expect(evaluateAccess({ userId, ...state, request: workspaceAccessRequest('/dan-khun-thot')! }).allowed).toBe(true);
  });

  it.each(['/admin', '/admin/login', '/admin/datasets', '/national', '/unknown-area', '/dan-khun-thot/t-300101', '//example.com', 'https://example.com/'])('does not manufacture an area or fallback permission for %s', path => {
    expect(workspaceAccessRequest(path)).toBeNull();
  });

  it('reuses the route identity for export and saved-workspace eligibility', () => {
    expect(workspaceAccessRequest('/dan-khun-thot?target=2025-12&horizon=6', 'forecast.export'))
      .toEqual({ ...ownDistrict, capability: 'forecast.export' });
    expect(workspaceAccessRequest('/drought', 'workspace.save'))
      .toEqual({ capability: 'workspace.save', area: { level: 'province', code: '30' } });
  });
});
