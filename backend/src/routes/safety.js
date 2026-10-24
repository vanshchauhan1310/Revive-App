import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { unwrap, badRequest } from '../errors.js';
import { uuid } from './_shared.js';

export function safetyRoutes({ admin, auth, limiters }) {
  const r = Router();

  const report = z.object({
    target_type: z.enum(['listing', 'message', 'user', 'order']),
    target_id: z.string().min(1).max(64),
    reason: z.enum(['unsafe_food', 'prohibited_item', 'harassment', 'spam', 'scam', 'no_show', 'inappropriate', 'other']),
    details: z.string().trim().max(1000).optional(),
  }).strict();

  r.post('/reports', auth.requireAuth, limiters.writes, validate({ body: report }), async (req, res) => {
    const b = req.valid.body;
    if (b.target_type === 'user' && b.target_id === req.user.id) throw badRequest('invalid_target', 'You cannot report yourself.');
    const row = unwrap(await admin.from('reports').insert({ ...b, reporter_id: req.user.id, source: 'user' }).select('id').single());
    res.status(201).json({ id: row.id });
  });

  r.post('/blocks', auth.requireAuth, limiters.writes, validate({ body: z.object({ user_id: uuid }) }), async (req, res) => {
    if (req.valid.body.user_id === req.user.id) throw badRequest('invalid_target', 'You cannot block yourself.');
    const { error } = await req.db.from('blocks').insert({ blocker_id: req.user.id, blocked_id: req.valid.body.user_id });
    if (error && error.code !== '23505') unwrap({ error });
    res.status(204).end();
  });

  r.delete('/blocks/:userId', auth.requireAuth, validate({ params: z.object({ userId: uuid }) }), async (req, res) => {
    unwrap(await req.db.from('blocks').delete().eq('blocker_id', req.user.id).eq('blocked_id', req.valid.params.userId));
    res.status(204).end();
  });

  return r;
}
