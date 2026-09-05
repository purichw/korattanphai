import { createClient } from "@supabase/supabase-js";
import type { AuthConfiguration } from "./authConfig";

// A named lazy boundary keeps SDK cost visible in the protected-build budget.
export function createAuthClient(config: AuthConfiguration) {
  return createClient(config.url, config.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, debug: false },
  });
}
