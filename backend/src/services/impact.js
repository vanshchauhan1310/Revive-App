// Estimates the environmental impact of completed exchanges via ml-service and stores it
// on the order. Missing values are retried by the background job.
export function createImpact({ admin, ml, logPrediction, logger }) {
  async function computeForOrders(orderIds) {
    if (!ml.enabled || !orderIds.length) return 0;
    const { data: orders, error } = await admin.from('orders')
      .select('id, listing_id, listings(kind, category, title, description, est_weight_kg, quantity_label)')
      .in('id', orderIds);
    if (error || !orders?.length) return 0;
    const items = orders.map((o) => ({ id: o.id, ...o.listings }));
    const result = await ml.impact(items);
    logPrediction({ task: 'impact', input: items, result });
    if (!result?.results) return 0;
    let n = 0;
    for (const r of result.results) {
      const { error: e } = await admin.from('orders')
        .update({ impact_kg_co2e: r.kg_co2e, impact_kg_waste: r.kg_waste }).eq('id', r.id);
      if (e) logger?.warn({ error: e.message }, 'impact update failed');
      else n += 1;
    }
    return n;
  }
  return { computeForOrders };
}
