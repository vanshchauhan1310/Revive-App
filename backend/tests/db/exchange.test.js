import { describe, test, expect, beforeEach } from 'vitest';
import { createDb, createUser, createListing, rpc, balance } from './harness.js';

let db, owner, buyer, other;

beforeEach(async () => {
  db = await createDb();
  owner = await createUser(db, 'Olive');
  buyer = await createUser(db, 'Bram');
  other = await createUser(db, 'Cleo');
}, 60000);

async function pickupCode(orderId) {
  const [row] = await rpc(db, buyer, 'issue_pickup_code', [orderId]);
  return row.issue_pickup_code.code;
}

async function acceptedOrder(listingOverrides = {}) {
  const listing = await createListing(db, owner, listingOverrides);
  const [order] = await rpc(db, buyer, 'request_listing', [listing.id, 'Hi!']);
  await rpc(db, owner, 'respond_order', [order.id, true]);
  await rpc(db, owner, 'mark_ready', [order.id]);
  return { listing, order };
}

describe('signup', () => {
  test('creates profile, wallet and exactly one welcome bonus', async () => {
    expect(await balance(db, owner)).toEqual({ balance: 100, held: 0 });
    await expect(
      db.query(`insert into public.credit_ledger (tx_id, account_id, amount, kind)
                values (gen_random_uuid(), $1, 100, 'signup_bonus')`, [owner]),
    ).rejects.toThrow(/credit_ledger_one_signup_bonus/);
  });
});

describe('requests and reservations', () => {
  test('owner cannot request their own listing', async () => {
    const l = await createListing(db, owner);
    await expect(rpc(db, owner, 'request_listing', [l.id, null])).rejects.toThrow('cannot_request_own_listing');
  });

  test('a requester cannot open two requests for the same listing', async () => {
    const l = await createListing(db, owner);
    await rpc(db, buyer, 'request_listing', [l.id, null]);
    await expect(rpc(db, buyer, 'request_listing', [l.id, null])).rejects.toThrow('already_requested');
  });

  test('accepting one request reserves the item and declines the others', async () => {
    const l = await createListing(db, owner);
    const [a] = await rpc(db, buyer, 'request_listing', [l.id, null]);
    const [b] = await rpc(db, other, 'request_listing', [l.id, null]);
    await rpc(db, owner, 'respond_order', [a.id, true]);
    const { rows } = await db.query('select id, status from public.orders order by created_at');
    expect(Object.fromEntries(rows.map((r) => [r.id, r.status]))).toEqual({ [a.id]: 'accepted', [b.id]: 'declined' });
    const { rows: [listing] } = await db.query('select status from public.listings where id = $1', [l.id]);
    expect(listing.status).toBe('reserved');
    await expect(rpc(db, owner, 'respond_order', [b.id, true])).rejects.toThrow('invalid_transition');
  });

  test('only the owner can accept', async () => {
    const l = await createListing(db, owner);
    const [o] = await rpc(db, buyer, 'request_listing', [l.id, null]);
    await expect(rpc(db, buyer, 'respond_order', [o.id, true])).rejects.toThrow('order_not_found');
    await expect(rpc(db, other, 'respond_order', [o.id, true])).rejects.toThrow('order_not_found');
  });

  test('expired food cannot be requested', async () => {
    const l = await createListing(db, owner, { expires_at: new Date(Date.now() - 60_000) });
    await expect(rpc(db, buyer, 'request_listing', [l.id, null])).rejects.toThrow('listing_unavailable');
  });

  test('acceptance fails when the requester cannot cover price + fee', async () => {
    const l = await createListing(db, owner, {
      title: 'Desk lamp', kind: 'non_food', category: 'electronics', condition: 'good',
      exchange_mode: 'credits', price_credits: 99,
    });
    const [o] = await rpc(db, buyer, 'request_listing', [l.id, null]);
    // 99 + ceil(1.98) = 101 > 100 welcome credits
    await expect(rpc(db, owner, 'respond_order', [o.id, true])).rejects.toThrow('insufficient_credits');
  });
});

describe('pickup code and settlement', () => {
  const paid = {
    title: 'Bike helmet', kind: 'non_food', category: 'sports', condition: 'like_new',
    exchange_mode: 'credits', price_credits: 50,
  };

  test('credits are held on accept and settled atomically on completion', async () => {
    const { order } = await acceptedOrder(paid);
    expect(await balance(db, buyer)).toEqual({ balance: 100, held: 51 });
    const code = await pickupCode(order.id);
    const [res] = await rpc(db, owner, 'complete_exchange', [order.id, code, 'key-0001-abcdef']);
    expect(res.complete_exchange.ok).toBe(true);
    expect(await balance(db, buyer)).toEqual({ balance: 49, held: 0 });
    expect(await balance(db, owner)).toEqual({ balance: 150, held: 0 });
    const { rows } = await db.query('select * from public.wallet_reconciliation');
    expect(rows).toEqual([]);
  });

  test('retrying with the same idempotency key does not charge twice', async () => {
    const { order } = await acceptedOrder(paid);
    const code = await pickupCode(order.id);
    await rpc(db, owner, 'complete_exchange', [order.id, code, 'key-0002-abcdef']);
    const [again] = await rpc(db, owner, 'complete_exchange', [order.id, code, 'key-0002-abcdef']);
    expect(again.complete_exchange).toMatchObject({ ok: true, replayed: true });
    expect(await balance(db, buyer)).toEqual({ balance: 49, held: 0 });
    await expect(rpc(db, owner, 'complete_exchange', [order.id, code, 'key-0003-other'])).rejects.toThrow('already_completed');
  });

  test('wrong codes are counted and locked out after the limit', async () => {
    const { order } = await acceptedOrder(paid);
    const code = await pickupCode(order.id);
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      const [r] = await rpc(db, owner, 'complete_exchange', [order.id, wrong, 'key-0004-abcdef']);
      expect(r.complete_exchange.error).toBe('invalid_code');
    }
    const [locked] = await rpc(db, owner, 'complete_exchange', [order.id, code, 'key-0004-abcdef']);
    expect(locked.complete_exchange.error).toBe('too_many_attempts');
    expect(await balance(db, buyer)).toEqual({ balance: 100, held: 51 });
  });

  test('expired codes are rejected', async () => {
    const { order } = await acceptedOrder(paid);
    const code = await pickupCode(order.id);
    await db.query(`update public.orders set otp_expires_at = now() - interval '1 minute' where id = $1`, [order.id]);
    const [r] = await rpc(db, owner, 'complete_exchange', [order.id, code, 'key-0005-abcdef']);
    expect(r.complete_exchange.error).toBe('code_expired');
  });

  test('only the requester can obtain the code and only the owner can complete', async () => {
    const { order } = await acceptedOrder(paid);
    await expect(rpc(db, owner, 'issue_pickup_code', [order.id])).rejects.toThrow('order_not_found');
    const code = await pickupCode(order.id);
    await expect(rpc(db, buyer, 'complete_exchange', [order.id, code, 'key-0006-abcdef'])).rejects.toThrow('order_not_found');
  });

  test('the code hash is never readable and plaintext is never stored', async () => {
    const { order } = await acceptedOrder(paid);
    const code = await pickupCode(order.id);
    const { rows: [o] } = await db.query('select otp_hash from public.orders where id = $1', [order.id]);
    expect(o.otp_hash).not.toContain(code);
    const notifs = await db.query('select body from public.notifications');
    expect(notifs.rows.some((n) => n.body.includes(code))).toBe(false);
  });

  test('cancelling releases the hold and reopens the listing', async () => {
    const { order, listing } = await acceptedOrder(paid);
    await rpc(db, owner, 'cancel_order', [order.id, 'no_show']);
    expect(await balance(db, buyer)).toEqual({ balance: 100, held: 0 });
    const { rows: [l] } = await db.query('select status from public.listings where id = $1', [listing.id]);
    expect(l.status).toBe('available');
  });

  test('stale reservations expire and release holds', async () => {
    const { order } = await acceptedOrder(paid);
    await db.query(`update public.orders set accepted_at = now() - interval '30 days' where id = $1`, [order.id]);
    const { rows: [r] } = await db.query('select public.expire_stale() as r');
    expect(r.r.orders_expired).toBe(1);
    expect(await balance(db, buyer)).toEqual({ balance: 100, held: 0 });
  });
});

describe('credit transfers', () => {
  test('cannot overspend, send non-positive amounts, or send to yourself', async () => {
    await expect(rpc(db, buyer, 'transfer_credits', [owner, 101, null])).rejects.toThrow('insufficient_credits');
    await expect(rpc(db, buyer, 'transfer_credits', [owner, -5, null])).rejects.toThrow('invalid_amount');
    await expect(rpc(db, buyer, 'transfer_credits', [buyer, 5, null])).rejects.toThrow('invalid_recipient');
    await rpc(db, buyer, 'transfer_credits', [owner, 40, 'thanks']);
    expect((await balance(db, buyer)).balance).toBe(60);
    expect((await balance(db, owner)).balance).toBe(140);
  });

  test('held credits cannot be transferred away', async () => {
    await acceptedOrder({
      title: 'Kettle', kind: 'non_food', category: 'kitchenware', condition: 'good',
      exchange_mode: 'credits', price_credits: 60,
    });
    // 100 balance, 62 held => only 38 spendable
    await expect(rpc(db, buyer, 'transfer_credits', [other, 39, null])).rejects.toThrow('insufficient_credits');
  });

  test('anonymous callers cannot call RPCs', async () => {
    await expect(rpc(db, null, 'transfer_credits', [owner, 1, null])).rejects.toThrow(/permission denied/);
  });

  test('the ledger is append-only, even for privileged roles', async () => {
    await expect(db.query('update public.credit_ledger set amount = 1000000')).rejects.toThrow('ledger_is_append_only');
    await expect(db.query('delete from public.credit_ledger')).rejects.toThrow('ledger_is_append_only');
  });
});
