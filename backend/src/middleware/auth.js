import { createHash } from 'node:crypto';
import { HttpError, forbidden } from '../errors.js';

const CACHE_TTL_MS = 30_000;
const MAX_CACHE = 5000;

// Verifies the Supabase access token on every request and attaches:
//   req.user = { id, email }  - the only source of identity for route handlers
//   req.db                    - a Supabase client acting as that user (RLS applies)
export function createAuth({ admin, userClient }) {
  const cache = new Map();

  async function verify(token) {
    const key = createHash('sha256').update(token).digest('hex');
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.user;
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data?.user) return null;
    const user = { id: data.user.id, email: data.user.email, emailConfirmed: Boolean(data.user.email_confirmed_at) };
    if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
    cache.set(key, { user, expires: Date.now() + CACHE_TTL_MS });
    return user;
  }

  function bearer(req) {
    const header = req.get('authorization') ?? '';
    const [scheme, token] = header.split(' ');
    return scheme?.toLowerCase() === 'bearer' && token ? token : null;
  }

  const attach = (req, token, user) => {
    req.user = user;
    req.db = userClient(token);
  };

  const requireAuth = async (req, _res, next) => {
    const token = bearer(req);
    if (!token) return next(new HttpError(401, 'not_authenticated', 'Please sign in.'));
    const user = await verify(token);
    if (!user) return next(new HttpError(401, 'not_authenticated', 'Your session has expired. Please sign in again.'));
    attach(req, token, user);
    next();
  };

  const optionalAuth = async (req, _res, next) => {
    const token = bearer(req);
    const user = token ? await verify(token) : null;
    if (user) attach(req, token, user);
    next();
  };

  const requireAdmin = async (req, _res, next) => {
    const { data } = await admin.from('profiles').select('role').eq('id', req.user.id).maybeSingle();
    if (data?.role !== 'admin') return next(forbidden());
    next();
  };

  return { requireAuth, optionalAuth, requireAdmin };
}
