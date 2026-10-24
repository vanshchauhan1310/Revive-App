import pino from 'pino';
import { createApp } from '../../src/app.js';
import { noLimits } from '../../src/middleware/rateLimit.js';

// Minimal stand-in for a supabase-js client. Query builders record every chained call and
// resolve to whatever the table handler returns for those calls.
export function fakeSupabase({ users = {}, tables = {}, rpc = {} } = {}) {
  const log = [];
  const from = (table) => {
    const ops = [];
    const proxy = new Proxy({}, {
      get(_t, prop) {
        if (prop === 'then') {
          const handler = tables[table];
          const result = typeof handler === 'function' ? handler(ops) : handler ?? { data: [], error: null };
          return (resolve, reject) => Promise.resolve(result).then(resolve, reject);
        }
        return (...args) => { ops.push([prop, ...args]); return proxy; };
      },
    });
    log.push({ table, ops });
    return proxy;
  };
  const rpcCalls = [];
  return {
    log,
    rpcCalls,
    from,
    rpc: async (name, args) => {
      rpcCalls.push({ name, args });
      const handler = rpc[name];
      return typeof handler === 'function' ? handler(args) : handler ?? { data: null, error: null };
    },
    auth: {
      getUser: async (token) => (users[token]
        ? { data: { user: users[token] }, error: null }
        : { data: { user: null }, error: { message: 'invalid JWT' } }),
      admin: { deleteUser: async () => ({ error: null }) },
    },
  };
}

export const ALICE = { id: '11111111-1111-4111-8111-111111111111', email: 'alice@example.test', email_confirmed_at: '2026-01-01' };
export const BOB_ID = '22222222-2222-4222-8222-222222222222';

export const config = {
  SUPABASE_URL: 'https://proj.supabase.co',
  corsOrigins: ['http://localhost:8081'],
};

export function buildApp({ admin, user, ml = {} } = {}) {
  admin ??= fakeSupabase();
  admin.auth.getUser ??= fakeSupabase({ users: { 'alice-token': ALICE } }).auth.getUser;
  user ??= fakeSupabase();
  const tokens = [];
  const userClient = (token) => { tokens.push(token); return user; };
  const mlClient = {
    enabled: true,
    suggestListing: async () => null, moderateText: async () => null, moderateImages: async () => null,
    embed: async () => null, rank: async () => null, risk: async () => null, impact: async () => null,
    ...ml,
  };
  const { app } = createApp({
    config, admin, anonDb: user, userClient, ml: mlClient, logger: pino({ level: 'silent' }), limiters: noLimits,
  });
  return { app, admin, user, tokens };
}

export const authed = { authorization: 'Bearer alice-token' };
