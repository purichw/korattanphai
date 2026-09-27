import { safeInternalRedirect } from './auth';

export type AuthScope = 'visitor' | 'admin';

export function authScopeForPath(path: string): AuthScope {
  return path === '/admin' || path.startsWith('/admin/') ? 'admin' : 'visitor';
}

export function authHome(scope: AuthScope) { return scope === 'admin' ? '/admin' : '/'; }
export function authLoginPath(scope: AuthScope) { return scope === 'admin' ? '/admin/login' : '/login'; }

export function authStorageKey(url: string, scope: AuthScope) {
  const project = new URL(url).hostname.split('.')[0];
  return `sb-${project}-auth-token${scope === 'admin' ? '-admin' : ''}`;
}

export function safeAuthRedirect(value: string | null, origin: string, scope: AuthScope) {
  const next = safeInternalRedirect(value, origin);
  return authScopeForPath(new URL(next, origin).pathname) === scope ? next : authHome(scope);
}
