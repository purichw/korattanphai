export type AuthConfiguration = { url: string; publishableKey: string };

export function readAuthConfiguration(urlValue?: string, keyValue?: string): AuthConfiguration | null {
  const url = urlValue?.trim();
  const publishableKey = keyValue?.trim();
  if (!url || !publishableKey) return null;
  // Only the browser-safe publishable key is accepted, never a privileged JWT/key.
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey) || /REPLACE|YOUR_/i.test(publishableKey)) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash
      || parsed.pathname !== "/" || !parsed.hostname.endsWith(".supabase.co")) return null;
    return { url: parsed.origin, publishableKey };
  } catch { return null; }
}
