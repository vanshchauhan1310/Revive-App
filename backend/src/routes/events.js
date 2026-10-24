import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { unwrap } from '../errors.js';
import { uuid } from './_shared.js';

// Client-side behaviour events feeding the recommender. 'request' and 'complete' are
// recorded server-side by the RPCs, so clients cannot inflate them.
const event = z.object({
  listing_id: uuid,
  event: z.enum(['impression', 'view', 'dismiss']),
  context: z.record(z.string(), z.union([z.string().max(100), z.number(), z.boolean()])).optional(),
});

export function eventRoutes({ admin, auth }) {
  const r = Router();
  r.post('/events', auth.optionalAuth, validate({ body: z.object({ events: z.array(event).min(1).max(50) }) }), async (req, res) => {
    const rows = req.valid.body.events.map((e) => ({
      user_id: req.user?.id ?? null, listing_id: e.listing_id, event: e.event, context: e.context ?? {},
    }));
    const { error } = await admin.from('interactions').insert(rows);
    if (error && error.code !== '23503') unwrap({ error }); // ignore unknown listing ids
    res.status(202).json({ accepted: rows.length });
  });
  return r;
}
