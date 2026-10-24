// Pure listing-draft logic (validation and API payload), shared by the form and tests.
import type { Condition, ExchangeMode, Kind, Listing } from '@/lib/types';

export const ALLERGENS = ['gluten', 'dairy', 'egg', 'nuts', 'peanuts', 'soy', 'fish', 'shellfish', 'sesame'];
export const DIETARY = ['vegetarian', 'vegan', 'halal', 'jain', 'gluten_free', 'contains_meat'];
export const CONDITIONS: Condition[] = ['new', 'like_new', 'good', 'fair'];
export const SHELF = [{ label: '4 hours', h: 4 }, { label: '12 hours', h: 12 }, { label: '1 day', h: 24 }, { label: '3 days', h: 72 }, { label: '1 week', h: 168 }];
export const PICKUP = ['today', 'tomorrow', 'this_week', 'flexible'] as const;
export type Pickup = (typeof PICKUP)[number];

export type ListingDraft = {
  images: string[];
  kind: Kind;
  category: string | null;
  title: string;
  description: string;
  condition: Condition | null;
  exchange_mode: ExchangeMode;
  price: string;
  quantity_label: string;
  allergens: string[];
  dietary_tags: string[];
  shelf_hours: number | null;
  expires_at: string | null;
  storage_info: string;
  pickup: Pickup;
  neighborhood: string;
  ai_assisted: boolean;
  est_weight_kg: number | null;
};

export const empty = (neighborhood = ''): ListingDraft => ({
  images: [], kind: 'food', category: null, title: '', description: '', condition: null, exchange_mode: 'free', price: '',
  quantity_label: '', allergens: [], dietary_tags: [], shelf_hours: 24, expires_at: null, storage_info: '', pickup: 'today',
  neighborhood, ai_assisted: false, est_weight_kg: null,
});

export function draftFromListing(l: Listing): ListingDraft {
  return {
    images: l.images, kind: l.kind, category: l.category, title: l.title, description: l.description, condition: l.condition,
    exchange_mode: l.exchange_mode, price: l.price_credits ? String(l.price_credits) : '', quantity_label: l.quantity_label ?? '',
    allergens: l.allergens, dietary_tags: l.dietary_tags, shelf_hours: null, expires_at: l.expires_at, storage_info: l.storage_info ?? '',
    pickup: 'flexible', neighborhood: l.neighborhood ?? '', ai_assisted: Boolean(l.ai_assisted), est_weight_kg: l.est_weight_kg ?? null,
  };
}

function pickupWindow(p: Pickup): { pickup_start: string | null; pickup_end: string | null } {
  const now = new Date();
  const endOf = (d: Date) => { const x = new Date(d); x.setHours(22, 0, 0, 0); return x; };
  if (p === 'today') return { pickup_start: now.toISOString(), pickup_end: endOf(now).getTime() > now.getTime() + 36e5 ? endOf(now).toISOString() : new Date(now.getTime() + 3 * 36e5).toISOString() };
  if (p === 'tomorrow') {
    const t = new Date(now); t.setDate(t.getDate() + 1); t.setHours(8, 0, 0, 0);
    return { pickup_start: t.toISOString(), pickup_end: endOf(t).toISOString() };
  }
  if (p === 'this_week') return { pickup_start: now.toISOString(), pickup_end: new Date(now.getTime() + 7 * 864e5).toISOString() };
  return { pickup_start: null, pickup_end: null };
}

export function toPayload(d: ListingDraft) {
  const isFood = d.kind === 'food';
  const expires = isFood ? (d.shelf_hours ? new Date(Date.now() + d.shelf_hours * 36e5).toISOString() : d.expires_at) : null;
  return {
    title: d.title.trim(),
    description: d.description.trim(),
    kind: d.kind,
    category: d.category,
    condition: isFood ? null : d.condition,
    exchange_mode: d.exchange_mode,
    price_credits: d.exchange_mode === 'credits' ? Number.parseInt(d.price, 10) || 0 : 0,
    quantity_label: d.quantity_label.trim() || null,
    images: d.images,
    neighborhood: d.neighborhood.trim() || null,
    allergens: isFood ? d.allergens : [],
    dietary_tags: isFood ? d.dietary_tags : [],
    prepared_at: null,
    expires_at: expires,
    storage_info: isFood ? d.storage_info.trim() || null : null,
    ...(d.pickup === 'flexible' && !isFood ? { pickup_start: null, pickup_end: null } : pickupWindow(d.pickup)),
    ai_assisted: d.ai_assisted,
    est_weight_kg: d.est_weight_kg,
  };
}

export function validateDraft(d: ListingDraft): Record<string, string> {
  const e: Record<string, string> = {};
  if (d.title.trim().length < 3) e.title = 'Give it a short, clear title (3+ characters).';
  if (!d.category) e.category = 'Choose a category.';
  if (d.kind === 'non_food' && !d.condition) e.condition = 'Select the condition.';
  if (d.kind === 'food' && !d.shelf_hours && !d.expires_at) e.shelf = 'How long will it stay good?';
  if (d.exchange_mode === 'credits' && !(Number.parseInt(d.price, 10) > 0)) e.price = 'Enter a price of at least 1 credit.';
  return e;
}

