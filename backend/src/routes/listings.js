import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { unwrap, HttpError, notFound, badRequest } from '../errors.js';
import { getCategories, embedListings } from '../services/listings.js';
import { idParams, limitParam, attachProfiles, ownStoragePrefix } from './_shared.js';

const FIELDS = `id, owner_id, title, description, kind, category, condition, exchange_mode, price_credits,
  quantity_label, images, neighborhood, lat, lng, allergens, dietary_tags, prepared_at, expires_at,
  storage_info, pickup_start, pickup_end, status, ai_assisted, est_weight_kg, created_at, updated_at`;

const tags = z.array(z.string().trim().min(1).max(40)).max(12);
const isoDate = z.iso.datetime({ offset: true });

const optional = (schema) => schema.nullable().optional();
const listingFields = {
  title: z.string().trim().min(3).max(80),
  description: z.string().trim().max(2000).optional(),
  kind: z.enum(['food', 'non_food']),
  category: z.string().min(2).max(40),
  condition: optional(z.enum(['new', 'like_new', 'good', 'fair'])),
  exchange_mode: z.enum(['free', 'credits']).default('free'),
  price_credits: z.number().int().min(0).max(100000).default(0),
  quantity_label: optional(z.string().trim().max(60)),
  images: z.array(z.url()).max(4).optional(),
  neighborhood: optional(z.string().trim().max(120)),
  lat: optional(z.number().min(-90).max(90)),
  lng: optional(z.number().min(-180).max(180)),
  allergens: tags.optional(),
  dietary_tags: tags.optional(),
  prepared_at: optional(isoDate),
  expires_at: optional(isoDate),
  storage_info: optional(z.string().trim().max(200)),
  pickup_start: optional(isoDate),
  pickup_end: optional(isoDate),
  ai_assisted: z.boolean().optional(),
  est_weight_kg: optional(z.number().positive().max(1000)),
};

const createSchema = z.object(listingFields).strict();
const EDITABLE = ['title', 'description', 'condition', 'exchange_mode', 'price_credits', 'quantity_label', 'images',
  'neighborhood', 'lat', 'lng', 'allergens', 'dietary_tags', 'prepared_at', 'expires_at', 'storage_info',
  'pickup_start', 'pickup_end', 'est_weight_kg'];
// Patch: every editable field optional and without defaults, so omitted fields stay unchanged.
const patchSchema = z.object(Object.fromEntries(EDITABLE.map((k) => {
  const f = listingFields[k];
  return [k, (f instanceof z.ZodDefault ? f.unwrap() : f).optional()];
}))).strict();

const searchSchema = z.object({
  q: z.string().trim().max(100).optional(),
  kind: z.enum(['food', 'non_food']).optional(),
  mode: z.enum(['free', 'credits']).optional(),
  category: z.string().max(40).optional(),
  collect_today: z.enum(['true', 'false']).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  within_km: z.coerce.number().positive().max(100).optional(),
  cursor: z.string().max(200).optional(),
  limit: limitParam(50, 20),
});

const distanceKm = (lat1, lng1, lat2, lng2) => {
  if ([lat1, lng1, lat2, lng2].some((v) => v == null)) return null;
  const rad = (d) => (d * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
};

export function listingRoutes(deps) {
  const { admin, anonDb, auth, limiters, config, moderation, logger } = deps;
  const r = Router();

  async function validateListing(body, userId) {
    const cats = await getCategories(admin);
    const cat = cats.find((c) => c.slug === body.category);
    if (!cat) throw badRequest('invalid_category', 'Choose a category from the list.');
    if (body.kind && cat.kind !== body.kind) throw badRequest('invalid_category', 'Category does not match the item type.');
    if (body.kind === 'non_food' && !body.condition) throw badRequest('condition_required', 'Select the item condition.');
    if (body.kind === 'food' && !body.expires_at) throw badRequest('expiry_required', 'Food listings need a "best before" time.');
    if (body.exchange_mode === 'free') body.price_credits = 0;
    if (body.exchange_mode === 'credits' && !(body.price_credits > 0)) throw badRequest('price_required', 'Set a price in credits.');
    const prefix = ownStoragePrefix(config, 'listing-images', userId);
    if ((body.images ?? []).some((u) => !u.startsWith(prefix))) {
      throw badRequest('invalid_image', 'Photos must be uploaded through the app.');
    }
    if (body.pickup_start && body.pickup_end && new Date(body.pickup_end) <= new Date(body.pickup_start)) {
      throw badRequest('invalid_pickup_window', 'Pickup window end must be after its start.');
    }
  }

  async function applyModeration(listing, verdict, userId) {
    if (verdict.status === 'pending_review') {
      await admin.from('reports').insert({
        target_type: 'listing', target_id: listing.id, source: 'ml',
        reason: verdict.reasons.some((x) => x.includes('prohibited')) ? 'prohibited_item' : 'inappropriate',
        details: verdict.reasons.join(', '), score: Math.max(verdict.scores.text ?? 0, verdict.scores.image ?? 0) || null,
      });
      await admin.from('notifications').insert({
        user_id: userId, type: 'listing_review', listing_id: listing.id, title: 'Listing under review',
        body: `"${listing.title}" will appear once a moderator approves it.`,
      });
    }
  }

  const reembed = (listing) => embedListings(deps, [listing]).catch((err) => logger.warn({ err: err.message }, 'embed failed'));

  r.get('/categories', async (_req, res) => res.json({ categories: await getCategories(admin) }));

  r.get('/listings', auth.optionalAuth, validate({ query: searchSchema }), async (req, res) => {
    const p = req.valid.query;
    const db = req.db ?? anonDb;
    let q = db.from('listings').select(FIELDS).eq('status', 'available')
      .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(p.limit + 1);
    if (p.q) q = q.textSearch('search', p.q, { type: 'websearch', config: 'simple' });
    if (p.kind) q = q.eq('kind', p.kind);
    if (p.mode) q = q.eq('exchange_mode', p.mode);
    if (p.category) q = q.eq('category', p.category);
    if (p.collect_today === 'true') {
      const end = new Date(); end.setHours(23, 59, 59, 999);
      q = q.or(`pickup_start.is.null,pickup_start.lte.${end.toISOString()}`)
        .or(`pickup_end.is.null,pickup_end.gte.${new Date().toISOString()}`)
        .or(`expires_at.is.null,expires_at.lte.${new Date(Date.now() + 36 * 36e5).toISOString()}`);
    }
    if (p.lat != null && p.lng != null && p.within_km) {
      const dLat = p.within_km / 111;
      const dLng = p.within_km / (111 * Math.max(Math.cos((p.lat * Math.PI) / 180), 0.1));
      q = q.gte('lat', p.lat - dLat).lte('lat', p.lat + dLat).gte('lng', p.lng - dLng).lte('lng', p.lng + dLng);
    }
    if (p.cursor) {
      const ts = Buffer.from(p.cursor, 'base64url').toString();
      if (Number.isNaN(Date.parse(ts))) throw badRequest('invalid_cursor', 'Invalid cursor.');
      q = q.lt('created_at', ts);
    }
    let rows = unwrap(await q);
    const hasMore = rows.length > p.limit;
    rows = rows.slice(0, p.limit).map((l) => ({ ...l, distance_km: distanceKm(p.lat, p.lng, l.lat, l.lng) }));
    if (p.within_km) rows = rows.filter((l) => l.distance_km == null || l.distance_km <= p.within_km);
    const items = await attachProfiles(admin, rows, 'owner_id', 'owner');
    const last = rows.at(-1);
    res.json({ items, next_cursor: hasMore && last ? Buffer.from(last.created_at).toString('base64url') : null });
  });

  r.get('/listings/mine', auth.requireAuth, async (req, res) => {
    const items = unwrap(await req.db.from('listings').select(FIELDS).eq('owner_id', req.user.id)
      .order('created_at', { ascending: false }).limit(200));
    res.json({ items });
  });

  r.get('/listings/:id', auth.optionalAuth, validate({ params: idParams }), async (req, res) => {
    const db = req.db ?? anonDb;
    const listing = unwrap(await db.from('listings').select(FIELDS).eq('id', req.valid.params.id).maybeSingle());
    if (!listing) throw notFound('listing_not_found', 'This item is no longer available.');
    const [withOwner] = await attachProfiles(admin, [listing], 'owner_id', 'owner');
    let saved = false;
    let myOrder = null;
    if (req.user) {
      const { data } = await req.db.from('saved_listings').select('listing_id').eq('listing_id', listing.id).maybeSingle();
      saved = Boolean(data);
      const { data: o } = await req.db.from('orders').select('id, status').eq('listing_id', listing.id)
        .eq('requester_id', req.user.id).in('status', ['requested', 'accepted', 'ready_for_pickup']).maybeSingle();
      myOrder = o ?? null;
      if (listing.owner_id !== req.user.id) {
        admin.from('interactions').insert({ user_id: req.user.id, listing_id: listing.id, event: 'view',
          context: { surface: 'detail' } }).then(() => {}, () => {});
      }
    }
    const { data: sim } = await admin.rpc('similar_listings', { p_listing: listing.id, p_limit: 6 });
    let similar = [];
    if (sim?.length) {
      const { data } = await admin.from('listings').select('id, title, images, kind, exchange_mode, price_credits')
        .in('id', sim.map((s) => s.listing_id)).eq('status', 'available');
      similar = data ?? [];
    }
    res.json({ listing: { ...withOwner, saved, my_order: myOrder }, similar });
  });

  r.post('/listings', auth.requireAuth, limiters.writes, validate({ body: createSchema }), async (req, res) => {
    const body = req.valid.body;
    await validateListing(body, req.user.id);
    const verdict = await moderation.reviewListing(body, { userId: req.user.id });
    if (verdict.status === 'rejected') {
      throw new HttpError(422, 'listing_rejected',
        verdict.reasons.includes('already_expired') ? 'This food has already passed its best-before time.'
          : 'This food has been out too long to share safely.', { reasons: verdict.reasons });
    }
    const { data: profile } = await admin.from('profiles').select('neighborhood, lat, lng').eq('id', req.user.id).single();
    const listing = unwrap(await admin.from('listings').insert({
      ...body,
      neighborhood: body.neighborhood ?? profile?.neighborhood ?? null,
      lat: body.lat ?? profile?.lat ?? null,
      lng: body.lng ?? profile?.lng ?? null,
      owner_id: req.user.id,
      status: verdict.status,
      moderation: { reasons: verdict.reasons, scores: verdict.scores, ml: verdict.ml, at: new Date().toISOString() },
    }).select(FIELDS).single());
    await applyModeration(listing, verdict, req.user.id);
    reembed(listing);
    res.status(201).json({ listing, moderation: { status: verdict.status, reasons: verdict.reasons } });
  });

  r.patch('/listings/:id', auth.requireAuth, limiters.writes, validate({ params: idParams, body: patchSchema }), async (req, res) => {
    const current = unwrap(await admin.from('listings').select(FIELDS).eq('id', req.valid.params.id)
      .eq('owner_id', req.user.id).maybeSingle());
    if (!current) throw notFound('listing_not_found', 'Listing not found.');
    if (!['available', 'pending_review'].includes(current.status)) {
      throw new HttpError(409, 'listing_locked', 'Reserved or closed listings cannot be edited.');
    }
    const next = { ...current, ...req.valid.body };
    await validateListing(next, req.user.id);
    const changes = { ...req.valid.body, price_credits: next.price_credits };
    const contentChanged = ['title', 'description', 'images', 'expires_at', 'prepared_at'].some((k) => k in req.valid.body);
    let verdict = null;
    if (contentChanged) {
      verdict = await moderation.reviewListing(next, { userId: req.user.id, listingId: current.id });
      if (verdict.status === 'rejected') throw new HttpError(422, 'listing_rejected', 'This food can no longer be shared safely.');
      changes.status = verdict.status === 'pending_review' ? 'pending_review' : current.status;
      changes.moderation = { reasons: verdict.reasons, scores: verdict.scores, ml: verdict.ml, at: new Date().toISOString() };
    }
    const listing = unwrap(await admin.from('listings').update(changes).eq('id', current.id).eq('owner_id', req.user.id)
      .in('status', ['available', 'pending_review']).select(FIELDS).maybeSingle());
    if (!listing) throw new HttpError(409, 'listing_locked', 'This listing changed. Refresh and try again.');
    if (verdict && verdict.status === 'pending_review' && current.status !== 'pending_review') await applyModeration(listing, verdict, req.user.id);
    if (contentChanged) reembed(listing);
    res.json({ listing });
  });

  r.delete('/listings/:id', auth.requireAuth, limiters.writes, validate({ params: idParams }), async (req, res) => {
    const listing = unwrap(await admin.from('listings').update({ status: 'archived' }).eq('id', req.valid.params.id)
      .eq('owner_id', req.user.id).in('status', ['available', 'pending_review']).select('id').maybeSingle());
    if (!listing) throw new HttpError(409, 'listing_locked', 'Cancel the active exchange before removing this item.');
    await admin.from('orders').update({ status: 'declined', closed_at: new Date().toISOString() })
      .eq('listing_id', listing.id).eq('status', 'requested');
    res.status(204).end();
  });

  r.post('/listings/:id/save', auth.requireAuth, validate({ params: idParams }), async (req, res) => {
    const { error } = await req.db.from('saved_listings').insert({ user_id: req.user.id, listing_id: req.valid.params.id });
    if (error && error.code !== '23505') unwrap({ error });
    admin.from('interactions').insert({ user_id: req.user.id, listing_id: req.valid.params.id, event: 'save' }).then(() => {}, () => {});
    res.status(204).end();
  });

  r.delete('/listings/:id/save', auth.requireAuth, validate({ params: idParams }), async (req, res) => {
    unwrap(await req.db.from('saved_listings').delete().eq('user_id', req.user.id).eq('listing_id', req.valid.params.id));
    admin.from('interactions').insert({ user_id: req.user.id, listing_id: req.valid.params.id, event: 'unsave' }).then(() => {}, () => {});
    res.status(204).end();
  });

  r.get('/saved', auth.requireAuth, async (req, res) => {
    const rows = unwrap(await req.db.from('saved_listings').select(`created_at, listing:listings(${FIELDS})`)
      .eq('user_id', req.user.id).order('created_at', { ascending: false }).limit(100));
    res.json({ items: rows.map((r) => r.listing).filter(Boolean) });
  });

  return r;
}
