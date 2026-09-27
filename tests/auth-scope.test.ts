import { describe, expect, it, vi } from 'vitest';
import { authHome, authLoginPath, authScopeForPath, authStorageKey, safeAuthRedirect } from '../src/authScope';
import { createAuthClient } from '../src/supabaseClient';
import { createClient } from '@supabase/supabase-js';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));
describe('separate admin authentication', () => {
  it('keeps visitor storage compatible and creates a distinct admin SDK session/broadcast key', () => {
    const config = { url: 'https://ktp-auth-test.supabase.co', publishableKey: 'sb_publishable_test_only' };
    for (const scope of ['visitor', 'admin'] as const) {
      createAuthClient(config, scope);
      expect(createClient).toHaveBeenLastCalledWith(config.url, config.publishableKey, {
        auth: { storageKey: authStorageKey(config.url, scope), persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, debug: false },
      });
    }
    expect(authStorageKey(config.url, 'visitor')).toBe('sb-ktp-auth-test-auth-token');
    expect(authStorageKey(config.url, 'admin')).toBe('sb-ktp-auth-test-auth-token-admin');
  });
  it('uses explicit admin routes, not similarly prefixed visitor routes', () => {
    for (const path of ['/admin', '/admin/', '/admin/login']) expect(authScopeForPath(path)).toBe('admin');
    for (const path of ['/', '/login', '/administrator']) expect(authScopeForPath(path)).toBe('visitor');
    expect(authHome('admin')).toBe('/admin'); expect(authLoginPath('admin')).toBe('/admin/login');
  });
  it('preserves same-scope draft links but rejects cross-scope and external login redirects', () => {
    const origin = 'https://example.test';
    expect(safeAuthRedirect('/admin?draft=123#records', origin, 'admin')).toBe('/admin?draft=123#records');
    for (const value of [null, '/', '/drought', '/login', '/admin/login', '//evil.test', '/\\evil.test', 'https://evil.test']) {
      expect(safeAuthRedirect(value, origin, 'admin')).toBe('/admin');
    }
    expect(safeAuthRedirect('/admin', origin, 'visitor')).toBe('/');
    expect(safeAuthRedirect('/drought?target=2025-12&horizon=4', origin, 'visitor')).toBe('/drought?target=2025-12&horizon=4');
  });
});
