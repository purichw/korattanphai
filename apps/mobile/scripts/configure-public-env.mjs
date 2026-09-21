import { readFileSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
const source = parseEnv(readFileSync(new URL('../../../.env.production.local', import.meta.url), 'utf8'));
const url = source.VITE_SUPABASE_URL;
const key = source.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url ?? '') || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key ?? '')) {
  throw new Error('Valid public Supabase configuration is required. No private keys are copied.');
}
writeFileSync(new URL('../.env.local', import.meta.url),
  `EXPO_PUBLIC_SUPABASE_URL=${url}\nEXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${key}\n`, { flag: 'wx' });
console.log('Configured only public Supabase URL/publishable key; no credentials copied.');
