// Boots the real Supabase migrations inside an in-process Postgres (PGlite) so the
// database rules (RLS, RPCs, ledger) can be tested without Docker or a live project.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { vector } from '@electric-sql/pglite-pgvector';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../supabase');

export async function createDb() {
  const db = new PGlite({ extensions: { pgcrypto, vector } });
  await db.exec(readFileSync(join(root, 'tests/supabase_stub.sql'), 'utf8'));
  const migrations = readdirSync(join(root, 'migrations'))
    .filter((f) => f.endsWith('.sql') && !f.includes('storage'))
    .sort();
  for (const file of migrations) {
    try {
      await db.exec(readFileSync(join(root, 'migrations', file), 'utf8'));
    } catch (err) {
      err.message = `${file}: ${err.message}`;
      throw err;
    }
  }
  return db;
}

export async function createUser(db, name, meta = {}) {
  const { rows } = await db.query(
    `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
    [`${name.toLowerCase()}@example.test`, { name, ...meta }],
  );
  return rows[0].id;
}

// Run fn as an authenticated user, the way PostgREST does: role + JWT claim, per transaction.
export async function as(db, uid, fn) {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid ?? '']);
    await tx.exec(uid ? 'set local role authenticated' : 'set local role anon');
    return fn(tx);
  });
}

export async function rpc(db, uid, fn, args = []) {
  const placeholders = args.map((_, i) => `$${i + 1}`).join(', ');
  return as(db, uid, async (tx) => (await tx.query(`select * from public.${fn}(${placeholders})`, args)).rows);
}

export async function createListing(db, ownerId, overrides = {}) {
  const l = {
    title: 'Sourdough loaf',
    kind: 'food',
    category: 'baked_goods',
    exchange_mode: 'free',
    price_credits: 0,
    condition: null,
    ...overrides,
  };
  const { rows } = await db.query(
    `insert into public.listings (owner_id, title, kind, category, exchange_mode, price_credits, condition, expires_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`,
    [ownerId, l.title, l.kind, l.category, l.exchange_mode, l.price_credits, l.condition, l.expires_at ?? null],
  );
  return rows[0];
}

export async function balance(db, uid) {
  const { rows } = await db.query('select balance, held from public.wallets where user_id = $1', [uid]);
  return { balance: Number(rows[0].balance), held: Number(rows[0].held) };
}
