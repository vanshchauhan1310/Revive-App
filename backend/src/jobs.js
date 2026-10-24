import { embedListings } from './services/listings.js';

// Periodic maintenance. Each task is independent and failures are logged, not thrown.
export function createJobs(deps) {
  const { admin, impact, logger } = deps;

  const tasks = {
    async expireStale() {
      const { data, error } = await admin.rpc('expire_stale');
      if (error) throw error;
      return data;
    },
    async embedMissing() {
      const { data: rows, error } = await admin.from('listings')
        .select('id, title, description, category, dietary_tags, listing_embeddings(listing_id)')
        .eq('status', 'available').is('listing_embeddings', null).limit(50);
      if (error) throw error;
      return { embedded: await embedListings(deps, rows ?? []) };
    },
    async impactBackfill() {
      const since = new Date(Date.now() - 30 * 864e5).toISOString();
      const { data, error } = await admin.from('orders').select('id').eq('status', 'completed')
        .is('impact_kg_co2e', null).gte('completed_at', since).limit(50);
      if (error) throw error;
      return { updated: await impact.computeForOrders((data ?? []).map((o) => o.id)) };
    },
    async reconcileWallets() {
      const { data, error } = await admin.from('wallet_reconciliation').select('*').limit(20);
      if (error) throw error;
      if (data?.length) logger.error({ wallets: data }, 'ALERT wallet balances disagree with the ledger');
      return { drifted: data?.length ?? 0 };
    },
  };

  async function runOnce() {
    const results = {};
    for (const [name, fn] of Object.entries(tasks)) {
      try {
        results[name] = await fn();
      } catch (err) {
        results[name] = { error: err.message };
        logger.warn({ job: name, err: err.message }, 'job failed');
      }
    }
    logger.info({ results }, 'maintenance jobs finished');
    return results;
  }

  function start(intervalMs) {
    const timer = setInterval(runOnce, intervalMs);
    timer.unref();
    setTimeout(runOnce, 5000).unref();
    return () => clearInterval(timer);
  }

  return { runOnce, start, tasks };
}
