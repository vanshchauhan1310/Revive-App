export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function timeUntil(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const s = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  if (s <= 0) return 'expired';
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))} min left`;
  if (s < 86400) return `${Math.floor(s / 3600)} h left`;
  return `${Math.floor(s / 86400)} days left`;
}

export const credits = (n: number) => `${n.toLocaleString()} credit${n === 1 ? '' : 's'}`;

export const priceLabel = (l: { exchange_mode: string; price_credits: number }) =>
  l.exchange_mode === 'free' ? 'Free' : credits(l.price_credits);

export function distanceLabel(km: number | null | undefined): string | null {
  if (km == null) return null;
  return km < 1 ? `${Math.round(km * 1000)} m away` : `${km.toFixed(1)} km away`;
}

export const humanize = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short' });
}
