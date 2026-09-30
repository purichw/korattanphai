import { createContext, Fragment, useContext, useEffect, useState, type ReactNode } from 'react';
import { evaluateAccess, isAccessArea, isAccessAssignment, isAccessPolicy, type AccessAssignment, type AccessDecision, type AccessPolicy, type AccessRequest } from './policy';

/** UI eligibility only. A ready snapshot must come from a trusted server adapter. */
export type WorkspaceAccessState =
  | { status: 'compatibility' }
  | { status: 'loading' | 'error' }
  | { status: 'ready'; policy: AccessPolicy; assignment: AccessAssignment };

export type WorkspaceAccessDecision = AccessDecision | { allowed: boolean; reason: 'compatibility' | 'access-unavailable' };
type WorkspaceAccessContextValue = {
  status: WorkspaceAccessState['status'] | 'unavailable';
  decide: (request: AccessRequest) => WorkspaceAccessDecision;
  can: (request: AccessRequest) => boolean;
};

const denied = (): WorkspaceAccessDecision => ({ allowed: false, reason: 'access-unavailable' });
const WorkspaceAccessContext = createContext<WorkspaceAccessContextValue>({ status: 'unavailable', decide: denied, can: () => false });

export function WorkspaceAccessProvider({ userId, state, children }: {
  userId: string;
  state: WorkspaceAccessState;
  children: ReactNode;
}) {
  const [clock, setClock] = useState(Date.now);
  const snapshot = state.status === 'ready' && isAccessPolicy(state.policy) && isAccessAssignment(state.assignment) ? state : null;
  // Re-evaluate mounted gates at expiry; browsers may clamp long timers.
  // The server must independently use its own clock when authorizing data.
  useEffect(() => {
    if (!snapshot) return;
    const now = Date.now();
    const expiries = snapshot.assignment.grants
      .filter(grant => grant.enabled && grant.expiresAt)
      .map(grant => Date.parse(grant.expiresAt!)).filter(expiry => expiry > clock);
    if (!expiries.length) return;
    // Include expiry between render and effect: it still invalidates the child
    // even if it is no longer in the future when the effect runs.
    const timer = window.setTimeout(() => setClock(Date.now()), Math.max(1, Math.min(Math.min(...expiries) - now + 1, 2_147_483_647)));
    return () => window.clearTimeout(timer);
  }, [snapshot, clock]);

  const decide = (request: AccessRequest): WorkspaceAccessDecision => {
    if (!userId) return denied();
    if (state.status === 'compatibility') {
      // Explicitly preserves today's published-data UI. This is NOT a role,
      // unknown-role fallback, CMS permission or a production enforcement switch.
      return isAccessArea(request.area) && ['forecast.view', 'forecast.export', 'workspace.save'].includes(request.capability)
        ? { allowed: true, reason: 'compatibility' } : { allowed: false, reason: 'invalid_request' };
    }
    if (state.status !== 'ready') return denied();
    return evaluateAccess({ userId, policy: state.policy, assignment: state.assignment, request });
  };
  // Policy/account replacement invalidates component-owned data and pending UI
  // work below this boundary. Shared/server caches still need their own checks.
  const revision = JSON.stringify([userId, state.status, snapshot?.policy.revision, snapshot?.assignment.revision, clock]);
  return <WorkspaceAccessContext.Provider value={{ status: state.status, decide, can: request => decide(request).allowed }}>
    <Fragment key={revision}>{children}</Fragment>
  </WorkspaceAccessContext.Provider>;
}

export const useWorkspaceAccess = () => useContext(WorkspaceAccessContext);

/** Denied children never mount. Callers supply their existing loading/denied UI. */
export function WorkspaceAccessBoundary({ request, fallback, children }: {
  request: AccessRequest;
  fallback: ReactNode;
  children: ReactNode;
}) {
  return useWorkspaceAccess().can(request) ? children : fallback;
}
