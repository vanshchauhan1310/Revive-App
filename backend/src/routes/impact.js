import { Router } from 'express';
import { unwrap } from '../errors.js';

export function impactRoutes({ admin, auth }) {
  const r = Router();
  r.get('/impact/me', auth.requireAuth, async (req, res) => {
    res.json({ impact: unwrap(await admin.rpc('impact_summary', { p_user: req.user.id })) });
  });
  r.get('/impact/community', async (_req, res) => {
    res.set('cache-control', 'public, max-age=300');
    res.json({ impact: unwrap(await admin.rpc('impact_summary', { p_user: null })) });
  });
  return r;
}
