import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { readAuthConfiguration } from '../../../src/authConfig';
import { sessionStorage } from './sessionStorage';
const configuration = readAuthConfiguration(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
export const backend = configuration ? createClient(configuration.url, configuration.publishableKey, {
  auth: { storage: sessionStorage(SecureStore), persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
}) : null;
