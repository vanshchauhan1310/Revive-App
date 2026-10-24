import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { unwrap, notFound, HttpError } from '../errors.js';
import { idParams, uuid, attachProfiles } from './_shared.js';

const ACTIVE = ['requested', 'accepted', 'ready_for_pickup', 'disputed'];
// Explicit columns: otp_hash is not selectable by clients (column privilege).
const ORDER_FIELDS = `id, listing_id, requester_id, owner_id, status, message, listing_title, price_credits,
  fee_credits, held_credits, otp_expires_at, otp_attempts, cancelled_by, cancel_reason, impact_kg_co2e,
  impact_kg_waste, accepted_at, ready_at, completed_at, closed_at, created_at, updated_at`;

export function orderRoutes({ admin, auth, limiters, impact }) {
  const r = Router();
  r.use('/orders', auth.requireAuth);

  async function hydrate(req, orders) {
    if (!orders.length) return orders;
    const { data: listings } = await req.db.from('listings').select('id, images, kind, category, status')
      .in('id', [...new Set(orders.map((o) => o.listing_id))]);
    const byId = new Map((listings ?? []).map((l) => [l.id, l]));
    const withListing = orders.map((o) => ({
      ...o,
      role: o.owner_id === req.user.id ? 'owner' : 'requester',
      listing: byId.get(o.listing_id) ?? null,
    }));
    const a = await attachProfiles(admin, withListing, 'owner_id', 'owner');
    return attachProfiles(admin, a, 'requester_id', 'requester');
  }

  const list = z.object({
    role: z.enum(['owner', 'requester', 'all']).default('all'),
    state: z.enum(['active', 'closed', 'all']).default('all'),
  });
  r.get('/orders', validate({ query: list }), async (req, res) => {
    const { role, state } = req.valid.query;
    let q = req.db.from('orders').select(ORDER_FIELDS).order('updated_at', { ascending: false }).limit(100);
    if (role === 'owner') q = q.eq('owner_id', req.user.id);
    if (role === 'requester') q = q.eq('requester_id', req.user.id);
    if (state === 'active') q = q.in('status', ACTIVE);
    if (state === 'closed') q = q.not('status', 'in', `(${ACTIVE.join(',')})`);
    res.json({ items: await hydrate(req, unwrap(await q)) });
  });

  r.get('/orders/:id', validate({ params: idParams }), async (req, res) => {
    const order = unwrap(await req.db.from('orders').select(ORDER_FIELDS).eq('id', req.valid.params.id).maybeSingle());
    if (!order) throw notFound('order_not_found', 'Exchange not found.');
    const [hydrated] = await hydrate(req, [order]);
    const { data: settlement } = await req.db.from('settlements').select('total_credits, created_at').eq('order_id', order.id).maybeSingle();
    const { data: chat } = await req.db.from('chats').select('id').eq('listing_id', order.listing_id)
      .eq('user_a', [order.owner_id, order.requester_id].sort()[0]).eq('user_b', [order.owner_id, order.requester_id].sort()[1]).maybeSingle();
    res.json({ order: { ...hydrated, settlement: settlement ?? null, chat_id: chat?.id ?? null } });
  });

  const rpc = async (req, fn, args) => unwrap(await req.db.rpc(fn, args));

  r.post('/orders', limiters.writes, validate({ body: z.object({ listing_id: uuid, message: z.string().trim().max(500).optional() }) }),
    async (req, res) => {
      const order = await rpc(req, 'request_listing', { p_listing: req.valid.body.listing_id, p_message: req.valid.body.message ?? null });
      res.status(201).json({ order });
    });

  r.post('/orders/:id/respond', limiters.writes, validate({ params: idParams, body: z.object({ accept: z.boolean() }) }),
    async (req, res) => res.json({ order: await rpc(req, 'respond_order', { p_order: req.valid.params.id, p_accept: req.valid.body.accept }) }));

  r.post('/orders/:id/ready', limiters.writes, validate({ params: idParams }),
    async (req, res) => res.json({ order: await rpc(req, 'mark_ready', { p_order: req.valid.params.id }) }));

  // Requester only (enforced in SQL). Response is never logged (see logger redaction).
  r.post('/orders/:id/pickup-code', limiters.sensitive, validate({ params: idParams }), async (req, res) => {
    res.set('cache-control', 'no-store');
    res.json(await rpc(req, 'issue_pickup_code', { p_order: req.valid.params.id }));
  });

  const complete = z.object({
    code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit pickup code.'),
    idempotency_key: z.string().min(8).max(100),
  });
  r.post('/orders/:id/complete', limiters.sensitive, validate({ params: idParams, body: complete }), async (req, res) => {
    const result = await rpc(req, 'complete_exchange', {
      p_order: req.valid.params.id, p_code: req.valid.body.code, p_idempotency_key: req.valid.body.idempotency_key,
    });
    if (!result.ok) {
      const messages = {
        invalid_code: `That code is not right. ${result.attempts_left} attempt(s) left.`,
        code_expired: 'The pickup code expired. Ask the requester to show a new one.',
        too_many_attempts: 'Too many wrong codes. Ask the requester to show a new one.',
      };
      throw new HttpError(422, result.error, messages[result.error] ?? 'Could not verify the code.', result);
    }
    if (!result.replayed) impact.computeForOrders([result.order_id]).catch(() => {});
    res.json(result);
  });

  const cancel = z.object({ reason: z.enum(['changed_mind', 'no_show', 'item_unavailable', 'other']).default('other') });
  r.post('/orders/:id/cancel', limiters.writes, validate({ params: idParams, body: cancel }),
    async (req, res) => res.json({ order: await rpc(req, 'cancel_order', { p_order: req.valid.params.id, p_reason: req.valid.body.reason }) }));

  r.post('/orders/:id/dispute', limiters.writes, validate({ params: idParams, body: z.object({ details: z.string().trim().min(10).max(1000) }) }),
    async (req, res) => res.json({ order: await rpc(req, 'open_dispute', { p_order: req.valid.params.id, p_details: req.valid.body.details }) }));

  return r;
}
