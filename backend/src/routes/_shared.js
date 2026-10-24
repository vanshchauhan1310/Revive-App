import { z } from 'zod';

export const uuid = z.uuid();
export const idParams = z.object({ id: uuid });
export const limitParam = (max = 50, dflt = 20) => z.coerce.number().int().min(1).max(max).default(dflt);

// Attaches { [as]: public profile } to each row for the given id column.
export async function attachProfiles(db, rows, column, as) {
  const ids = [...new Set(rows.map((r) => r[column]).filter(Boolean))];
  if (!ids.length) return rows;
  const { data } = await db.from('public_profiles').select('id, display_name, avatar_url, neighborhood, reliability_score').in('id', ids);
  const byId = new Map((data ?? []).map((p) => [p.id, p]));
  return rows.map((r) => ({ ...r, [as]: byId.get(r[column]) ?? null }));
}

// Public storage URL prefix a user may reference in their listings/avatars.
export function ownStoragePrefix(config, bucket, userId) {
  return `${config.SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${userId}/`;
}
