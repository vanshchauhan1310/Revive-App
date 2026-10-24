import { createHash } from 'node:crypto';

// Writes one ml_predictions row per AI call so every model decision is auditable and
// can be evaluated later (drift, accuracy, latency). Never blocks or fails the request.
export function createPredictionLog({ admin, logger }) {
  return function logPrediction({ task, input, result, userId = null, listingId = null }) {
    const meta = result?.meta ?? {};
    const row = {
      task,
      model: meta.model ?? 'fallback',
      model_version: meta.model_version ?? null,
      prompt_version: meta.prompt_version ?? null,
      input_hash: input === undefined ? null : createHash('sha256').update(JSON.stringify(input)).digest('hex'),
      output: result ? stripMeta(result) : null,
      latency_ms: meta.latency_ms ?? null,
      fallback: !result || Boolean(meta.fallback),
      error: result ? null : 'unavailable',
      user_id: userId,
      listing_id: listingId,
    };
    Promise.resolve(admin.from('ml_predictions').insert(row))
      .then(({ error } = {}) => error && logger?.warn({ error: error.message }, 'prediction log failed'))
      .catch((err) => logger?.warn({ err: err.message }, 'prediction log failed'));
  };
}

function stripMeta({ meta, ...rest }) { // eslint-disable-line no-unused-vars
  return rest;
}
