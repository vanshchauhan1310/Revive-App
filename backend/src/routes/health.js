import { Router } from 'express';

export function healthRoutes({ admin, ml }) {
  const r = Router();
  r.get('/health', (_req, res) => res.json({ ok: true }));
  r.get('/ready', async (_req, res) => {
    const { error } = await admin.from('categories').select('slug').limit(1);
    res.status(error ? 503 : 200).json({ ok: !error, database: !error, ml: ml.enabled });
  });
  return r;
}
