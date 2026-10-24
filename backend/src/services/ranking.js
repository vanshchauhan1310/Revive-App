// Fallback ranking used when ml-service is unavailable or has no trained model yet.
// Mirrors ml-service/app/ranking.py::heuristic_score so behaviour is consistent.
export function heuristicScore(c) {
  const freshness = Math.exp(-(c.age_hours ?? 0) / 48);
  const distance = c.distance_km == null ? 0.5 : 1 / (1 + c.distance_km / 2);
  const popularity = Math.log1p(Number(c.popularity ?? 0)) / Math.log(20);
  const similarity = c.similarity == null ? 0.5 : c.similarity;
  const urgency = c.hours_to_expiry == null ? 0 : c.hours_to_expiry < 6 ? 0.3 : c.hours_to_expiry < 24 ? 0.15 : 0;
  const free = c.exchange_mode === 'free' ? 0.1 : 0;
  const image = c.has_image ? 0.1 : 0;
  return 0.35 * similarity + 0.25 * distance + 0.2 * freshness + 0.1 * Math.min(popularity, 1) + urgency + free + image;
}

export function rankFallback(candidates) {
  return candidates
    .map((c) => ({ listing_id: c.listing_id, score: heuristicScore(c) }))
    .sort((a, b) => b.score - a.score);
}
