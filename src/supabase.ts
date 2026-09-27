import type { SupabaseClient } from "@supabase/supabase-js";
import { readAuthConfiguration } from "./authConfig";
import { authScopeForPath, type AuthScope } from './authScope';

let clientPromise: Promise<SupabaseClient> | undefined;
let clientScope: AuthScope | undefined;

export async function getSupabaseClient(): Promise<SupabaseClient | null> {
  const config = readAuthConfiguration(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
  if (!config) return null;
  const scope = authScopeForPath(window.location.pathname);
  if (clientScope && scope !== clientScope) throw new Error('Authentication scope requires document navigation');
  clientScope = scope;
  // Load the SDK separately from the login shell and share one session manager.
  clientPromise ??= import("./supabaseClient").then(({ createAuthClient }) => createAuthClient(config, scope)).catch(() => {
    clientPromise = undefined;
    throw new Error("Authentication client unavailable");
  });
  return clientPromise;
}
