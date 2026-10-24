import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { unwrap, HttpError } from '../errors.js';
import { ownStoragePrefix } from './_shared.js';

export function meRoutes({ admin, auth, limiters, config }) {
  const r = Router();

  r.get('/me', auth.requireAuth, async (req, res) => {
    const profile = unwrap(await req.db.from('profiles').select('*').eq('id', req.user.id).single());
    const wallet = unwrap(await req.db.from('wallets').select('balance, held').eq('user_id', req.user.id).single());
    const { count: unread } = await req.db
      .from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
    res.json({
      profile: { ...profile, email: req.user.email, email_confirmed: req.user.emailConfirmed },
      wallet: { ...wallet, available: wallet.balance - wallet.held },
      unread_notifications: unread ?? 0,
    });
  });

  // Explicit allowlist: role, reliability_score, deleted_at etc. can never be set here.
  const patch = z.object({
    display_name: z.string().trim().min(1).max(80).optional(),
    avatar_url: z.url().nullable().optional(),
    phone: z.string().trim().max(30).nullable().optional(),
    neighborhood: z.string().trim().max(120).nullable().optional(),
    lat: z.number().min(-90).max(90).nullable().optional(),
    lng: z.number().min(-180).max(180).nullable().optional(),
    notification_prefs: z.object({ orders: z.boolean(), messages: z.boolean() }).optional(),
  }).strict();

  r.patch('/me', auth.requireAuth, limiters.writes, validate({ body: patch }), async (req, res) => {
    const body = req.valid.body;
    if (body.avatar_url && !body.avatar_url.startsWith(ownStoragePrefix(config, 'avatars', req.user.id))) {
      throw new HttpError(400, 'invalid_image', 'Avatar must be uploaded through the app.');
    }
    const profile = unwrap(await req.db.from('profiles').update(body).eq('id', req.user.id).select('*').single());
    res.json({ profile });
  });

  // Account deletion: anonymise the profile, withdraw listings, soft-delete the auth user.
  // Exchange history is kept (with the anonymised name) for the other participant.
  r.delete('/me', auth.requireAuth, limiters.sensitive, async (req, res) => {
    const uid = req.user.id;
    const { count } = await admin.from('orders').select('id', { count: 'exact', head: true })
      .or(`requester_id.eq.${uid},owner_id.eq.${uid}`).in('status', ['accepted', 'ready_for_pickup', 'disputed']);
    if (count) throw new HttpError(409, 'active_exchanges', 'Finish or cancel your active exchanges first.');
    unwrap(await admin.from('orders').update({ status: 'cancelled', cancelled_by: uid, cancel_reason: 'other', closed_at: new Date().toISOString() })
      .eq('requester_id', uid).eq('status', 'requested'));
    unwrap(await admin.from('listings').update({ status: 'removed' }).eq('owner_id', uid).in('status', ['available', 'pending_review']));
    unwrap(await admin.from('profiles').update({
      display_name: 'Deleted user', avatar_url: null, phone: null, lat: null, lng: null, neighborhood: null,
      deleted_at: new Date().toISOString(),
    }).eq('id', uid));
    const { error } = await admin.auth.admin.deleteUser(uid, true);
    if (error) req.log.error({ error: error.message }, 'auth user soft-delete failed');
    res.status(204).end();
  });

  return r;
}
