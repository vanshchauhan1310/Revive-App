import { createClient } from '@supabase/supabase-js';
import { loadConfig } from './config.js';
import { createLogger } from './logger.js';
import { createAdminClient, createUserClientFactory } from './db.js';
import { createMlClient } from './services/ml.js';
import { createApp } from './app.js';
import { createJobs } from './jobs.js';

const config = loadConfig();
const logger = createLogger(config.LOG_LEVEL, config.NODE_ENV === 'development');
const admin = createAdminClient(config);
const anonDb = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const ml = createMlClient({ url: config.ML_SERVICE_URL, token: config.ML_SERVICE_TOKEN, timeoutMs: config.ML_TIMEOUT_MS, logger });

const { app, deps } = createApp({ config, admin, anonDb, userClient: createUserClientFactory(config), ml, logger });
const server = app.listen(config.PORT, config.HOST, () => {
  logger.info({ port: config.PORT, host: config.HOST, ml: ml.enabled }, 'EcoShare API listening');
});

const stopJobs = config.JOBS_ENABLED ? createJobs(deps).start(config.JOBS_INTERVAL_MS) : () => {};

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    logger.info({ signal }, 'shutting down');
    stopJobs();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
