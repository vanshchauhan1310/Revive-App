import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { HttpError, badRequest } from '../errors.js';
import { getCategories } from '../services/listings.js';
import { ownStoragePrefix } from './_shared.js';

const CONDITIONS = ['new', 'like_new', 'good', 'fair'];

// Smart listing: photo (+ optional hint) -> draft fields. The user always reviews them.
export function aiRoutes({ admin, auth, limiters, ml, logPrediction, config }) {
  const r = Router();
  const body = z.object({
    image_url: z.url(),
    kind_hint: z.enum(['food', 'non_food']).optional(),
    notes: z.string().trim().max(300).optional(),
  }).strict();

  r.post('/ai/listing-suggest', auth.requireAuth, limiters.ai, validate({ body }), async (req, res) => {
    const { image_url, kind_hint, notes } = req.valid.body;
    if (!image_url.startsWith(ownStoragePrefix(config, 'listing-images', req.user.id))) {
      throw badRequest('invalid_image', 'Upload the photo through the app first.');
    }
    if (!ml.enabled) throw new HttpError(503, 'ai_unavailable', 'AI assist is not configured.');
    const categories = await getCategories(admin);
    const input = { image_url, kind_hint: kind_hint ?? null, notes: notes ?? null, categories: categories.map((c) => ({ slug: c.slug, kind: c.kind, label: c.label })) };
    const result = await ml.suggestListing(input);
    logPrediction({ task: 'listing_suggest', input, result, userId: req.user.id });
    if (!result?.suggestion) throw new HttpError(503, 'ai_unavailable', 'AI assist is busy. Please fill in the details yourself.');

    // Never trust model output shape: clamp to our taxonomy and limits.
    const s = result.suggestion;
    const cat = categories.find((c) => c.slug === s.category) ?? null;
    const kind = cat?.kind ?? (s.kind === 'food' || s.kind === 'non_food' ? s.kind : kind_hint ?? null);
    res.json({
      suggestion: {
        title: typeof s.title === 'string' ? s.title.slice(0, 80) : '',
        description: typeof s.description === 'string' ? s.description.slice(0, 2000) : '',
        kind,
        category: cat?.slug ?? null,
        condition: kind === 'non_food' && CONDITIONS.includes(s.condition) ? s.condition : null,
        allergens: Array.isArray(s.allergens) ? s.allergens.filter((x) => typeof x === 'string').slice(0, 12) : [],
        dietary_tags: Array.isArray(s.dietary_tags) ? s.dietary_tags.filter((x) => typeof x === 'string').slice(0, 12) : [],
        storage_info: typeof s.storage_info === 'string' ? s.storage_info.slice(0, 200) : null,
        shelf_life_hours: Number.isFinite(s.shelf_life_hours) ? Math.min(Math.max(s.shelf_life_hours, 1), 24 * 30) : null,
        est_weight_kg: Number.isFinite(s.est_weight_kg) && s.est_weight_kg > 0 ? Math.min(s.est_weight_kg, 1000) : null,
        safety_notes: Array.isArray(s.safety_notes) ? s.safety_notes.slice(0, 5) : [],
        confidence: Number.isFinite(s.confidence) ? s.confidence : null,
      },
      meta: { model: result.meta?.model, prompt_version: result.meta?.prompt_version, fallback: Boolean(result.meta?.fallback) },
    });
  });

  return r;
}
