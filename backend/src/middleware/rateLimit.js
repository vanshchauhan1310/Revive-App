import { rateLimit, ipKeyGenerator } from 'express-rate-limit';

const keyByUser = (req) => req.user?.id ?? ipKeyGenerator(req.ip ?? '');
const json = (message) => ({ error: { code: 'rate_limited', message } });

export const limiters = {
  global: rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: 'draft-8', legacyHeaders: false,
    message: json('Too many requests. Please slow down.') }),
  writes: rateLimit({ windowMs: 60 * 1000, limit: 60, keyGenerator: keyByUser, standardHeaders: 'draft-8',
    legacyHeaders: false, message: json('Too many changes in a short time.') }),
  sensitive: rateLimit({ windowMs: 60 * 60 * 1000, limit: 30, keyGenerator: keyByUser, standardHeaders: 'draft-8',
    legacyHeaders: false, message: json('Too many attempts. Try again later.') }),
  ai: rateLimit({ windowMs: 60 * 60 * 1000, limit: 40, keyGenerator: keyByUser, standardHeaders: 'draft-8',
    legacyHeaders: false, message: json('AI assist limit reached. Try again later.') }),
};

export const noLimits = Object.fromEntries(Object.keys(limiters).map((k) => [k, (_req, _res, next) => next()]));
