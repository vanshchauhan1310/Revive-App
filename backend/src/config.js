import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.string().default('info'),
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  // Comma-separated list of allowed browser origins. Native apps send no Origin header.
  CORS_ORIGINS: z.string().default('http://localhost:8081'),
  ML_SERVICE_URL: z.url().optional(),
  ML_SERVICE_TOKEN: z.string().optional(),
  ML_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  JOBS_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  JOBS_INTERVAL_MS: z.coerce.number().int().positive().default(10 * 60 * 1000),
});

export function loadConfig(env = process.env) {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid backend configuration:\n${problems}\nSee backend/.env.example`);
  }
  const config = parsed.data;
  if (config.NODE_ENV === 'production' && config.ML_SERVICE_URL && !config.ML_SERVICE_TOKEN) {
    throw new Error('ML_SERVICE_TOKEN is required in production when ML_SERVICE_URL is set');
  }
  return {
    ...config,
    corsOrigins: config.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
  };
}
