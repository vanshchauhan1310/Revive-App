import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { unwrap } from '../errors.js';
import { uuid } from './_shared.js';

export function creditRoutes({ auth, limiters }) {
  const r = Router();
  r.use('/credits', auth.requireAuth);

  r.get('/credits/wallet', async (req, res) => {
    const w = unwrap(await req.db.from('wallets').select('balance, held, updated_at').eq('user_id', req.user.id).single());
    res.json({ wallet: { ...w, available: w.balance - w.held } });
  });

  r.get('/credits/ledger', validate({ query: z.object({ before: z.coerce.number().int().positive().optional() }) }), async (req, res) => {
    let q = req.db.from('credit_ledger').select('id, tx_id, amount, kind, order_id, description, created_at')
      .eq('account_id', req.user.id).order('id', { ascending: false }).limit(30);
    if (req.valid.query.before) q = q.lt('id', req.valid.query.before);
    const items = unwrap(await q);
    res.json({ items, next_before: items.length === 30 ? items.at(-1).id : null });
  });

  // Sender is always the verified caller (auth.uid() inside transfer_credits).
  const transfer = z.object({ recipient_id: uuid, amount: z.number().int().min(1).max(100000), note: z.string().trim().max(200).optional() }).strict();
  r.post('/credits/transfer', limiters.sensitive, validate({ body: transfer }), async (req, res) => {
    const tx = unwrap(await req.db.rpc('transfer_credits', {
      p_recipient: req.valid.body.recipient_id, p_amount: req.valid.body.amount, p_note: req.valid.body.note ?? null,
    }));
    res.status(201).json({ tx_id: tx });
  });

  return r;
}
