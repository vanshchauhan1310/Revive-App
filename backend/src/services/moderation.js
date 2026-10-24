// Trust & safety decisions for listings and messages. ML scores come from ml-service;
// deterministic rules always run, so moderation still works when ML is unavailable.

const PROHIBITED = [
  /\b(alcohol|beer|wine|vodka|whisk(e)?y|liquor)\b/i,
  /\b(cigarette|vape|tobacco|nicotine)\b/i,
  /\b(prescription|antibiotic|medicine|tablets?|pills?|syringe)\b/i,
  /\b(gun|pistol|ammo|ammunition|knife set for sale)\b/i,
  /\b(baby formula opened|raw meat leftover)\b/i,
];
const CONTACT_SPAM = /(https?:\/\/|www\.|\b\d{10}\b|whatsapp\s*me)/i;

export const FOOD_LIMITS_HOURS = { cooked_meal: 24, dairy: 72, baked_goods: 96 };

export function ruleCheckListing(listing, now = new Date()) {
  const reasons = [];
  const text = `${listing.title} ${listing.description ?? ''}`;
  if (PROHIBITED.some((re) => re.test(text))) reasons.push('prohibited_item');
  if (CONTACT_SPAM.test(text)) reasons.push('contact_details');
  if (listing.kind === 'food') {
    if (listing.expires_at && new Date(listing.expires_at) <= now) reasons.push('already_expired');
    const limit = FOOD_LIMITS_HOURS[listing.category];
    const start = listing.prepared_at ? new Date(listing.prepared_at) : null;
    if (limit && start && (now - start) / 36e5 > limit) reasons.push('unsafe_food_age');
  }
  return reasons;
}

export function createModeration({ ml, logPrediction, threshold = 0.8, blockThreshold = 0.93 }) {
  async function scoreText(texts, ctx) {
    const result = await ml.moderateText(texts);
    logPrediction({ task: 'moderate_text', input: texts, result, ...ctx });
    return result;
  }

  return {
    // Returns { status, reasons, scores } for a new or edited listing.
    async reviewListing(listing, ctx = {}) {
      const reasons = ruleCheckListing(listing);
      const scores = {};
      const text = await scoreText([`${listing.title}\n${listing.description ?? ''}`], ctx);
      if (text?.results?.[0]) {
        scores.text = text.results[0].score;
        if (text.results[0].score >= threshold) reasons.push(`text_${text.results[0].label}`);
      }
      if (listing.images?.length) {
        const img = await ml.moderateImages(listing.images);
        logPrediction({ task: 'moderate_image', input: listing.images, result: img, ...ctx });
        const worst = Math.max(0, ...(img?.results ?? []).map((r) => r.score));
        scores.image = worst;
        if (worst >= threshold) reasons.push('image_nsfw');
      }
      const hardFail = reasons.includes('already_expired') || reasons.includes('unsafe_food_age');
      return {
        status: hardFail ? 'rejected' : reasons.length ? 'pending_review' : 'available',
        reasons,
        scores,
        ml: Boolean(text),
      };
    },

    // Returns { action: 'allow' | 'flag' | 'block', score, label }.
    async reviewMessage(body, ctx = {}) {
      const result = await scoreText([body], ctx);
      const top = result?.results?.[0];
      if (!top) return { action: 'allow', score: null, label: null };
      if (top.score >= blockThreshold) return { action: 'block', score: top.score, label: top.label };
      if (top.score >= threshold) return { action: 'flag', score: top.score, label: top.label };
      return { action: 'allow', score: top.score, label: top.label };
    },
  };
}
