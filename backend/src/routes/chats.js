import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { unwrap, notFound, HttpError } from '../errors.js';
import { idParams, uuid, limitParam } from './_shared.js';

export function chatRoutes({ admin, auth, limiters, moderation }) {
  const r = Router();
  r.use('/chats', auth.requireAuth);

  async function participantChat(req, id) {
    const chat = unwrap(await req.db.from('chats').select('*').eq('id', id).maybeSingle());
    if (!chat) throw notFound('chat_not_found', 'Conversation not found.');
    return chat;
  }

  r.get('/chats', async (req, res) => {
    res.json({ items: unwrap(await req.db.rpc('my_inbox')) });
  });

  r.post('/chats', limiters.writes, validate({ body: z.object({ other_user_id: uuid, listing_id: uuid.optional() }) }), async (req, res) => {
    const id = unwrap(await req.db.rpc('get_or_create_chat', { p_other: req.valid.body.other_user_id, p_listing: req.valid.body.listing_id ?? null }));
    res.status(201).json({ id });
  });

  r.get('/chats/:id', validate({ params: idParams }), async (req, res) => {
    const chat = await participantChat(req, req.valid.params.id);
    const otherId = chat.user_a === req.user.id ? chat.user_b : chat.user_a;
    const { data: other } = await admin.from('public_profiles').select('id, display_name, avatar_url, reliability_score').eq('id', otherId).single();
    let listing = null;
    if (chat.listing_id) {
      const { data } = await admin.from('listings').select('id, title, images, status, owner_id, exchange_mode, price_credits').eq('id', chat.listing_id).maybeSingle();
      listing = data;
    }
    res.json({ chat: { ...chat, other, listing } });
  });

  const page = z.object({ before: z.coerce.number().int().positive().optional(), limit: limitParam(100, 40) });
  r.get('/chats/:id/messages', validate({ params: idParams, query: page }), async (req, res) => {
    let q = req.db.from('messages').select('id, chat_id, sender_id, body, client_id, flagged, created_at')
      .eq('chat_id', req.valid.params.id).order('id', { ascending: false }).limit(req.valid.query.limit);
    if (req.valid.query.before) q = q.lt('id', req.valid.query.before);
    const rows = unwrap(await q);
    res.json({ items: rows.reverse(), has_more: rows.length === req.valid.query.limit });
  });

  const send = z.object({ body: z.string().trim().min(1).max(2000), client_id: uuid });
  r.post('/chats/:id/messages', limiters.writes, validate({ params: idParams, body: send }), async (req, res) => {
    const chat = await participantChat(req, req.valid.params.id);
    const otherId = chat.user_a === req.user.id ? chat.user_b : chat.user_a;
    const { data: blocked } = await admin.rpc('is_blocked', { p_a: req.user.id, p_b: otherId });
    if (blocked) throw new HttpError(403, 'blocked', 'You cannot message this user.');

    // Idempotent on (sender_id, client_id): a retried send returns the original message.
    const { data: existing } = await admin.from('messages').select('*').eq('sender_id', req.user.id).eq('client_id', req.valid.body.client_id).maybeSingle();
    if (existing) return res.status(200).json({ message: existing });

    const verdict = await moderation.reviewMessage(req.valid.body.body, { userId: req.user.id });
    if (verdict.action === 'block') {
      throw new HttpError(422, 'message_blocked', 'This message looks abusive and was not sent.');
    }
    const message = unwrap(await admin.from('messages').insert({
      chat_id: chat.id, sender_id: req.user.id, body: req.valid.body.body,
      client_id: req.valid.body.client_id, flagged: verdict.action === 'flag',
    }).select('*').single());
    if (verdict.action === 'flag') {
      await admin.from('reports').insert({ target_type: 'message', target_id: String(message.id), reason: 'harassment',
        source: 'ml', score: verdict.score, details: verdict.label });
    }
    res.status(201).json({ message });
  });

  r.post('/chats/:id/read', validate({ params: idParams, body: z.object({ last_id: z.number().int().nonnegative() }) }), async (req, res) => {
    unwrap(await req.db.rpc('mark_chat_read', { p_chat: req.valid.params.id, p_last_id: req.valid.body.last_id }));
    res.status(204).end();
  });

  return r;
}
