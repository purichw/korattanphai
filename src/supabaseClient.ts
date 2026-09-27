import { createClient } from "@supabase/supabase-js";
import type { AuthConfiguration } from "./authConfig";
import { authStorageKey, type AuthScope } from './authScope';

// A named lazy boundary keeps SDK cost visible in the protected-build budget.
export function createAuthClient(config: AuthConfiguration, scope: AuthScope = 'visitor') {
  return createClient(config.url, config.publishableKey, {
    auth: { storageKey: authStorageKey(config.url, scope), persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, debug: false },
  });
}
