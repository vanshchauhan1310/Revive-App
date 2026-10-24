// Client for ml-service (Python). Every call has a hard timeout and returns null on any
// failure so callers can fall back to non-AI behaviour; the app must work without AI.
export function createMlClient({ url, token, timeoutMs = 8000, logger, fetchImpl = fetch }) {
  async function call(path, body, { timeout = timeoutMs } = {}) {
    if (!url) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const started = Date.now();
    try {
      const res = await fetchImpl(`${url}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`ml-service ${path} responded ${res.status}`);
      return await res.json();
    } catch (err) {
      logger?.warn({ path, ms: Date.now() - started, err: err.message }, 'ml-service call failed; using fallback');
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    enabled: Boolean(url),
    suggestListing: (input) => call('/v1/listing/suggest', input, { timeout: Math.max(timeoutMs, 25000) }),
    moderateText: (texts) => call('/v1/moderate/text', { texts }),
    moderateImages: (image_urls) => call('/v1/moderate/image', { image_urls }, { timeout: Math.max(timeoutMs, 15000) }),
    embed: (texts) => call('/v1/embed', { texts }),
    rank: (input) => call('/v1/rank', input),
    risk: (rows) => call('/v1/risk', { rows }),
    impact: (items) => call('/v1/impact', { items }),
  };
}
