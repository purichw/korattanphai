import type { SupabaseClient } from "@supabase/supabase-js";
import { readAuthConfiguration } from "./authConfig";

let clientPromise: Promise<SupabaseClient> | undefined;

export async function getSupabaseClient(): Promise<SupabaseClient | null> {
  const config = readAuthConfiguration(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
  if (!config) return null;
  // Load the SDK separately from the login shell and share one session manager.
  clientPromise ??= import("./supabaseClient").then(({ createAuthClient }) => createAuthClient(config)).catch(() => {
    clientPromise = undefined;
    throw new Error("Authentication client unavailable");
  });
  return clientPromise;
}
