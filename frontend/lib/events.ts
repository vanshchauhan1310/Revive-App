import { api } from './api';

type Event = { listing_id: string; event: 'impression' | 'view' | 'dismiss'; context?: Record<string, string | number | boolean> };

// Batches behaviour events for the recommender; best effort, never blocks the UI.
let queue: Event[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

export function track(e: Event) {
  queue.push(e);
  if (queue.length >= 20) flush();
  else if (!timer) timer = setTimeout(flush, 4000);
}

export async function flush() {
  if (timer) clearTimeout(timer);
  timer = null;
  const batch = queue.splice(0, 50);
  if (!batch.length) return;
  try {
    await api('/events', { method: 'POST', body: { events: batch } });
  } catch {
    // dropped: analytics must never affect the user
  }
}
