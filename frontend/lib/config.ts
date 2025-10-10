// Configuration file for environment variables
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Runtime-aware default for local development:
// - Android emulators should use 10.0.2.2 to reach host machine
// - iOS simulator and web can use localhost
// - Physical devices should use the machine LAN IP (provide via EXPO_PUBLIC_API_URL)
const runtimeDefault = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

const envApiUrl = process.env.EXPO_PUBLIC_API_URL || process.env.API_BASE_URL || (Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL as string) || (Constants.manifest?.extra?.EXPO_PUBLIC_API_URL as string) || '';

const API_BASE_URL = envApiUrl || runtimeDefault || 'http://192.168.29.61:3000';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://bzqqeativrabfbcqlzzl.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6cXFlYXRpdnJhYmZiY3FsenpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2NTQ3ODksImV4cCI6MjA2NjIzMDc4OX0.sY1Y_g0GG2WIM36P4mMEB4toxtGC_HqOU4olWMsNxiI';

console.log('🔧 [config] API_BASE_URL =', API_BASE_URL, ' (envApiUrl=', !!envApiUrl, ', platform=', Platform.OS, ')');

export const config = {
  API_BASE_URL,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
};

export default config;