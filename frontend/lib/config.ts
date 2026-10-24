// Public runtime configuration (EXPO_PUBLIC_* values are embedded in the app bundle,
// so only publishable values belong here; never a service-role key).
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing ${name}. Copy frontend/.env.example to frontend/.env and fill it in.`);
  }
  return value;
}

export const config = {
  apiUrl: required('EXPO_PUBLIC_API_URL', process.env.EXPO_PUBLIC_API_URL).replace(/\/$/, ''),
  supabaseUrl: required('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL).replace(/\/$/, ''),
  supabaseAnonKey: required('EXPO_PUBLIC_SUPABASE_ANON_KEY', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
  googleAuthEnabled: process.env.EXPO_PUBLIC_GOOGLE_AUTH === 'true',
};
