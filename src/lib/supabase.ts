import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';
import { Platform } from 'react-native';

// Only publishable credentials belong in the mobile bundle. Never use a service-role key.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const validUrl = (() => {
  try { return !!url && ['https:', 'http:'].includes(new URL(url).protocol); } catch { return false; }
})();
export const isBackendConfigured = validUrl && !!key;

// The navigation shell can run before a developer connects a Supabase project.
export const supabase = isBackendConfigured ? createClient(url!, key!, {
  auth: {
    ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
    flowType: 'pkce',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    lock: processLock,
  },
}) : null;
