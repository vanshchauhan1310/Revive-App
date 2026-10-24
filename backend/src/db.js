import { createClient } from '@supabase/supabase-js';

const noSession = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

// Bypasses RLS. Only use it for system writes, and always scope by the verified user id.
export function createAdminClient(config) {
  return createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, noSession);
}

// Acts as the calling user: RLS applies and auth.uid() resolves inside RPCs.
export function createUserClientFactory(config) {
  return (accessToken) =>
    createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
      ...noSession,
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
}
