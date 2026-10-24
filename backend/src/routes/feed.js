import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { unwrap } from '../errors.js';
import { rankFallback } from '../services/ranking.js';
import { attachProfiles, limitParam } from './_shared.js';

const CARD_FIELDS = `id, owner_id, title, description, kind, category, condition, exchange_mode, price_credits,
  quantity_label, images, neighborhood, lat, lng, dietary_tags, allergens, expires_at, pickup_start, pickup_end, created_at`;

const FEATURE_KEYS = ['similarity', 'distance_km', 'age_hours', 'hours_to_expiry', 'popularity', 'owner_reliability',
  'kind', 'exchange_mode', 'price_credits', 'has_image'];
const servedFeatures = (c = {}) => Object.fromEntries(FEATURE_KEYS.map((k) => [k, c[k] ?? null]));

// "For you": pgvector candidate generation in Postgres -> ML re-ranking -> hydrate.
export function feedRoutes({ admin, auth, ml, logPrediction }) {
  const r = Router();
  const query = z.object({
    kind: z.enum(['food', 'non_food']).optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    limit: limitParam(40, 20),
  });

  r.get('/feed', auth.optionalAuth, validate({ query }), async (req, res) => {
    const p = req.valid.query;
    const userId = req.user?.id ?? null;
    let { lat, lng } = p;
    if (userId && (lat == null || lng == null)) {
      const { data } = await admin.from('profiles').select('lat, lng').eq('id', userId).single();
      lat ??= data?.lat ?? undefined;
      lng ??= data?.lng ?? undefined;
    }
    const candidates = unwrap(await admin.rpc('recommend_candidates', {
      p_user: userId, p_lat: lat ?? null, p_lng: lng ?? null, p_kind: p.kind ?? null, p_limit: 200,
    }));
    if (!candidates.length) return res.json({ items: [], model: null });

    const ranked = await ml.rank({ user_id: userId, candidates });
    logPrediction({ task: 'rank', input: { user: userId, n: candidates.length }, userId,
      result: ranked && { top: ranked.scores.slice(0, 20), meta: ranked.meta } });
    const order = ranked?.scores ?? rankFallback(candidates);
    const model = ranked?.meta?.model_version ? `${ranked.meta.model}@${ranked.meta.model_version}` : 'heuristic';

    const top = order.slice(0, p.limit);
    const rows = unwrap(await admin.from('listings').select(CARD_FIELDS).in('id', top.map((t) => t.listing_id)).eq('status', 'available'));
    const byId = new Map(rows.map((l) => [l.id, l]));
    const byCandidate = new Map(candidates.map((c) => [c.listing_id, c]));
    const items = await attachProfiles(admin, top.filter((t) => byId.has(t.listing_id)).map((t, i) => ({
      ...byId.get(t.listing_id),
      distance_km: byCandidate.get(t.listing_id)?.distance_km ?? null,
      rank: i + 1,
      score: Number(t.score.toFixed(4)),
    })), 'owner_id', 'owner');

    if (userId && items.length) {
      admin.from('interactions').insert(items.map((it) => ({
        user_id: userId, listing_id: it.id, event: 'impression',
        // Features as served: the trainer reads these back, avoiding training/serving skew.
        context: { surface: 'for_you', rank: it.rank, model, f: servedFeatures(byCandidate.get(it.id)) },
      }))).then(() => {}, () => {});
    }
    res.json({ items, model });
  });

  return r;
}
