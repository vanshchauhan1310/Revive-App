// Embedding text and caching of reference data shared by listing routes and jobs.

const categoryCache = new WeakMap(); // per client, refreshed every 10 minutes

export async function getCategories(db) {
  const hit = categoryCache.get(db);
  if (hit && Date.now() - hit.at < 10 * 60 * 1000 && hit.rows.length) return hit.rows;
  const { data, error } = await db.from('categories').select('slug, kind, label').order('sort_order');
  if (error) throw error;
  categoryCache.set(db, { at: Date.now(), rows: data });
  return data;
}

export function embeddingText(listing, categoryLabel = listing.category) {
  return [listing.title, categoryLabel, listing.description, (listing.dietary_tags ?? []).join(' ')]
    .filter(Boolean).join('. ').slice(0, 1000);
}

// Embeds listings and upserts listing_embeddings. Returns number embedded.
export async function embedListings({ admin, ml, logPrediction, logger }, listings) {
  if (!ml.enabled || !listings.length) return 0;
  const cats = new Map((await getCategories(admin)).map((c) => [c.slug, c.label]));
  const texts = listings.map((l) => embeddingText(l, cats.get(l.category)));
  const result = await ml.embed(texts);
  logPrediction({ task: 'embed', input: texts.length, result: result && { count: result.vectors?.length, meta: result.meta } });
  if (!result?.vectors?.length) return 0;
  const rows = listings.map((l, i) => ({
    listing_id: l.id,
    embedding: JSON.stringify(result.vectors[i]),
    model: result.meta?.model ?? 'unknown',
    updated_at: new Date().toISOString(),
  }));
  const { error } = await admin.from('listing_embeddings').upsert(rows);
  if (error) logger?.warn({ error: error.message }, 'embedding upsert failed');
  return error ? 0 : rows.length;
}
