import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';
import { config } from './config';

// SecureStore values are limited to ~2KB, so large session blobs are chunked.
const CHUNK = 1800;
const nativeStorage = {
  async getItem(key: string) {
    const count = await SecureStore.getItemAsync(`${key}.n`);
    if (!count) return SecureStore.getItemAsync(key);
    const parts = await Promise.all(Array.from({ length: Number(count) }, (_, i) => SecureStore.getItemAsync(`${key}.${i}`)));
    return parts.join('');
  },
  async setItem(key: string, value: string) {
    const parts = value.match(new RegExp(`.{1,${CHUNK}}`, 'gs')) ?? [''];
    await Promise.all(parts.map((p, i) => SecureStore.setItemAsync(`${key}.${i}`, p)));
    await SecureStore.setItemAsync(`${key}.n`, String(parts.length));
  },
  async removeItem(key: string) {
    const count = Number((await SecureStore.getItemAsync(`${key}.n`)) ?? 0);
    await Promise.all([
      SecureStore.deleteItemAsync(key),
      SecureStore.deleteItemAsync(`${key}.n`),
      ...Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(`${key}.${i}`)),
    ]);
  },
};

const webStorage = {
  getItem: async (key: string) => (typeof window === 'undefined' ? null : window.localStorage.getItem(key)),
  setItem: async (key: string, value: string) => { if (typeof window !== 'undefined') window.localStorage.setItem(key, value); },
  removeItem: async (key: string) => { if (typeof window !== 'undefined') window.localStorage.removeItem(key); },
};

export const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
  auth: {
    storage: Platform.OS === 'web' ? webStorage : nativeStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

// Refresh tokens only while the app is in the foreground (Supabase RN guidance).
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
