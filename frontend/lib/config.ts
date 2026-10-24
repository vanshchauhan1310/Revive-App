// Configuration file for environment variables
export const config = {
  API_BASE_URL: process.env.EXPO_PUBLIC_API_URL || 'http://192.168.58.90:3000',
  SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://bzqqeativrabfbcqlzzl.supabase.co',
  SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6cXFlYXRpdnJhYmZiY3FsenpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2NTQ3ODksImV4cCI6MjA2NjIzMDc4OX0.sY1Y_g0GG2WIM36P4mMEB4toxtGC_HqOU4olWMsNxiI',
};

export default config; 