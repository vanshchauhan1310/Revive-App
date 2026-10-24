import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { unwrap } from '../errors.js';
import { idParams } from './_shared.js';

export function notificationRoutes({ admin, auth }) {
  const r = Router();
  r.use('/notifications', auth.requireAuth);

  r.get('/notifications', validate({ query: z.object({ before: z.iso.datetime({ offset: true }).optional() }) }), async (req, res) => {
    let q = req.db.from('notifications').select('*').order('created_at', { ascending: false }).limit(50);
    if (req.valid.query.before) q = q.lt('created_at', req.valid.query.before);
    const items = unwrap(await q);
    res.json({ items, unread: items.filter((n) => !n.read_at).length });
  });

  r.post('/notifications/:id/read', validate({ params: idParams }), async (req, res) => {
    unwrap(await admin.from('notifications').update({ read_at: new Date().toISOString() })
      .eq('id', req.valid.params.id).eq('user_id', req.user.id).is('read_at', null));
    res.status(204).end();
  });

  r.post('/notifications/read-all', async (req, res) => {
    unwrap(await admin.from('notifications').update({ read_at: new Date().toISOString() })
      .eq('user_id', req.user.id).is('read_at', null));
    res.status(204).end();
  });

  return r;
}
