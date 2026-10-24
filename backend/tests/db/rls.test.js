import { describe, test, expect, beforeEach } from 'vitest';
import { createDb, createUser, createListing, rpc, as } from './harness.js';

let db, alice, bob, eve;

beforeEach(async () => {
  db = await createDb();
  alice = await createUser(db, 'Alice');
  bob = await createUser(db, 'Bob');
  eve = await createUser(db, 'Eve');
}, 60000);

const q = (uid, sql, args) => as(db, uid, async (tx) => (await tx.query(sql, args)).rows);

describe('row level security', () => {
  test("a user cannot edit or delete another user's listing", async () => {
    const l = await createListing(db, alice);
    await expect(q(eve, `update public.listings set title = 'hacked' where id = $1`, [l.id])).rejects.toThrow(/permission denied/);
    await expect(q(eve, `delete from public.listings where id = $1`, [l.id])).rejects.toThrow(/permission denied/);
    await expect(
      q(eve, `insert into public.listings (owner_id, title, kind, category) values ($1, 'fake', 'food', 'produce')`, [alice]),
    ).rejects.toThrow(/permission denied/);
  });

  test('anyone can browse available listings but not archived ones', async () => {
    await createListing(db, alice, { title: 'Visible soup' });
    const hidden = await createListing(db, alice, { title: 'Hidden soup' });
    await db.query(`update public.listings set status = 'archived' where id = $1`, [hidden.id]);
    const rows = await q(null, 'select title from public.listings');
    expect(rows.map((r) => r.title)).toEqual(['Visible soup']);
    const own = await q(alice, 'select title from public.listings order by title');
    expect(own).toHaveLength(2);
  });

  test('a non-participant cannot read a conversation', async () => {
    const l = await createListing(db, alice);
    const [{ get_or_create_chat: chatId }] = await rpc(db, bob, 'get_or_create_chat', [alice, l.id]);
    await db.query(`insert into public.messages (chat_id, sender_id, body, client_id) values ($1, $2, 'hello', gen_random_uuid())`, [chatId, bob]);
    expect(await q(alice, 'select body from public.messages')).toHaveLength(1);
    expect(await q(eve, 'select body from public.messages')).toHaveLength(0);
    expect(await q(eve, 'select * from public.chats')).toHaveLength(0);
    await expect(q(eve, `insert into public.messages (chat_id, sender_id, body, client_id) values ($1, $2, 'spoof', gen_random_uuid())`, [chatId, alice]))
      .rejects.toThrow(/permission denied/);
  });

  test('wallets, ledger, notifications and orders are private', async () => {
    expect(await q(eve, 'select * from public.wallets')).toHaveLength(1);
    expect(await q(eve, 'select * from public.credit_ledger')).toHaveLength(1);
    const l = await createListing(db, alice);
    await rpc(db, bob, 'request_listing', [l.id, null]);
    expect(await q(eve, 'select id from public.orders')).toHaveLength(0);
    expect(await q(bob, 'select id, status from public.orders')).toHaveLength(1);
    await expect(q(bob, 'select otp_hash from public.orders')).rejects.toThrow(/permission denied/);
    expect(await q(eve, 'select * from public.notifications')).toHaveLength(0);
    expect(await q(alice, 'select * from public.notifications')).toHaveLength(1);
  });

  test('users cannot grant themselves credits or admin rights', async () => {
    await expect(q(eve, 'update public.wallets set balance = 999999')).rejects.toThrow(/permission denied/);
    await expect(
      q(eve, `insert into public.credit_ledger (tx_id, account_id, amount, kind) values (gen_random_uuid(), $1, 5, 'adjustment')`, [eve]),
    ).rejects.toThrow(/permission denied/);
    await expect(q(eve, `update public.profiles set role = 'admin' where id = $1`, [eve])).rejects.toThrow(/permission denied/);
    const updated = await q(eve, `update public.profiles set display_name = 'Eve 2' where id = $1 returning display_name`, [eve]);
    expect(updated[0].display_name).toBe('Eve 2');
  });

  test('private profile fields are hidden; public profile is visible', async () => {
    await db.query(`update public.profiles set phone = '+1 555 0100' where id = $1`, [alice]);
    expect(await q(eve, 'select phone from public.profiles where id = $1', [alice])).toHaveLength(0);
    const pub = await q(eve, 'select display_name from public.public_profiles where id = $1', [alice]);
    expect(pub[0].display_name).toBe('Alice');
  });

  test('training and reconciliation views are not exposed to clients', async () => {
    await expect(q(eve, 'select * from public.ml_order_outcomes')).rejects.toThrow(/permission denied/);
    await expect(q(eve, 'select * from public.wallet_reconciliation')).rejects.toThrow(/permission denied/);
    await expect(q(eve, 'select * from public.interactions')).resolves.toHaveLength(0);
  });

  test('blocked users cannot chat or request', async () => {
    await q(alice, 'insert into public.blocks (blocker_id, blocked_id) values ($1, $2)', [alice, eve]);
    const l = await createListing(db, alice);
    await expect(rpc(db, eve, 'get_or_create_chat', [alice, l.id])).rejects.toThrow('blocked');
    await expect(rpc(db, eve, 'request_listing', [l.id, null])).rejects.toThrow('blocked');
  });

  test('inbox shows unread counts per conversation', async () => {
    const l = await createListing(db, alice, { title: 'Mangoes' });
    const [{ get_or_create_chat: chatId }] = await rpc(db, bob, 'get_or_create_chat', [alice, l.id]);
    const [{ get_or_create_chat: same }] = await rpc(db, alice, 'get_or_create_chat', [bob, l.id]);
    expect(same).toBe(chatId);
    for (const body of ['hi', 'still available?']) {
      await db.query(`insert into public.messages (chat_id, sender_id, body, client_id) values ($1, $2, $3, gen_random_uuid())`, [chatId, bob, body]);
    }
    const [row] = await rpc(db, alice, 'my_inbox');
    expect(row).toMatchObject({ listing_title: 'Mangoes', other_name: 'Bob', last_message_preview: 'still available?' });
    expect(Number(row.unread_count)).toBe(2);
  });
});
