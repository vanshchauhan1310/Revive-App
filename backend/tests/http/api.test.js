import { describe, test, expect } from 'vitest';
import request from 'supertest';
import { buildApp, fakeSupabase, authed, ALICE, BOB_ID } from './fakes.js';

const adminWithAlice = (opts = {}) => fakeSupabase({ users: { 'alice-token': ALICE }, ...opts });

describe('authentication', () => {
  test.each([
    ['get', '/api/me'], ['post', '/api/credits/transfer'], ['get', '/api/orders'], ['post', '/api/listings'],
    ['get', '/api/chats'], ['post', '/api/ai/listing-suggest'], ['get', '/api/admin/reports'],
  ])('%s %s requires a token', async (method, path) => {
    const { app } = buildApp({ admin: adminWithAlice() });
    const res = await request(app)[method](path).send({});
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('not_authenticated');
  });

  test('rejects an invalid token', async () => {
    const { app } = buildApp({ admin: adminWithAlice() });
    const res = await request(app).get('/api/me').set('authorization', 'Bearer forged');
    expect(res.status).toBe(401);
  });

  test('admin routes reject non-admins', async () => {
    const admin = adminWithAlice({ tables: { profiles: { data: { role: 'user' }, error: null } } });
    const { app } = buildApp({ admin });
    const res = await request(app).get('/api/admin/reports').set(authed);
    expect(res.status).toBe(403);
  });
});

describe('credit transfers', () => {
  test('identity comes from the token, never from the body', async () => {
    const user = fakeSupabase({ rpc: { transfer_credits: { data: 'tx-1', error: null } } });
    const { app, tokens } = buildApp({ admin: adminWithAlice(), user });
    const forged = await request(app).post('/api/credits/transfer').set(authed)
      .send({ recipient_id: BOB_ID, amount: 5, sender_id: BOB_ID });
    expect(forged.status).toBe(400);

    const res = await request(app).post('/api/credits/transfer').set(authed).send({ recipient_id: BOB_ID, amount: 5 });
    expect(res.status).toBe(201);
    expect(tokens).toContain('alice-token');
    expect(user.rpcCalls).toEqual([{ name: 'transfer_credits', args: { p_recipient: BOB_ID, p_amount: 5, p_note: null } }]);
  });

  test.each([[-5], [0], [1.5], ['10']])('rejects amount %s', async (amount) => {
    const { app } = buildApp({ admin: adminWithAlice() });
    const res = await request(app).post('/api/credits/transfer').set(authed).send({ recipient_id: BOB_ID, amount });
    expect(res.status).toBe(400);
  });

  test('maps database errors to stable codes', async () => {
    const user = fakeSupabase({ rpc: { transfer_credits: { data: null, error: { message: 'insufficient_credits' } } } });
    const { app } = buildApp({ admin: adminWithAlice(), user });
    const res = await request(app).post('/api/credits/transfer').set(authed).send({ recipient_id: BOB_ID, amount: 5 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('insufficient_credits');
  });
});

describe('listings', () => {
  const categories = { data: [{ slug: 'electronics', kind: 'non_food', label: 'Electronics' }], error: null };
  const base = { title: 'Desk lamp', kind: 'non_food', category: 'electronics', condition: 'good' };

  test('owner_id cannot be supplied by the client', async () => {
    const { app } = buildApp({ admin: adminWithAlice({ tables: { categories } }) });
    const res = await request(app).post('/api/listings').set(authed).send({ ...base, owner_id: BOB_ID });
    expect(res.status).toBe(400);
  });

  test('rejects photos outside the caller\'s storage folder', async () => {
    const { app } = buildApp({ admin: adminWithAlice({ tables: { categories } }) });
    const res = await request(app).post('/api/listings').set(authed).send({
      ...base, images: [`https://proj.supabase.co/storage/v1/object/public/listing-images/${BOB_ID}/x.jpg`],
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_image');
  });

  test('inserts with the verified owner and moderation status', async () => {
    let inserted;
    const admin = adminWithAlice({
      tables: {
        categories,
        profiles: { data: { neighborhood: 'Sector 21', lat: null, lng: null }, error: null },
        listings: (ops) => {
          const ins = ops.find(([op]) => op === 'insert');
          if (ins) inserted = ins[1];
          return { data: { id: 'l1', ...inserted }, error: null };
        },
      },
    });
    const ml = { moderateText: async () => ({ results: [{ label: 'toxic', score: 0.01 }], meta: { model: 'm' } }) };
    const { app } = buildApp({ admin, ml });
    const res = await request(app).post('/api/listings').set(authed).send(base);
    expect(res.status).toBe(201);
    expect(inserted.owner_id).toBe(ALICE.id);
    expect(inserted.status).toBe('available');
    expect(inserted.neighborhood).toBe('Sector 21');
  });

  test('prohibited items go to review even when ML is down', async () => {
    let inserted;
    const admin = adminWithAlice({
      tables: {
        categories,
        profiles: { data: {}, error: null },
        listings: (ops) => {
          inserted = ops.find(([op]) => op === 'insert')?.[1] ?? inserted;
          return { data: { id: 'l1', ...inserted }, error: null };
        },
      },
    });
    const { app } = buildApp({ admin });
    const res = await request(app).post('/api/listings').set(authed).send({ ...base, title: 'Spare vape pens' });
    expect(res.status).toBe(201);
    expect(inserted.status).toBe('pending_review');
    expect(admin.log.some((c) => c.table === 'reports')).toBe(true);
  });

  test('food past its best-before time is rejected', async () => {
    const admin = adminWithAlice({ tables: { categories: { data: [{ slug: 'cooked_meal', kind: 'food', label: 'Cooked meal' }], error: null } } });
    const { app } = buildApp({ admin });
    const res = await request(app).post('/api/listings').set(authed).send({
      title: 'Leftover biryani', kind: 'food', category: 'cooked_meal', expires_at: new Date(Date.now() - 6e4).toISOString(),
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('listing_rejected');
  });

  test('food needs a best-before time', async () => {
    const admin = adminWithAlice({ tables: { categories: { data: [{ slug: 'cooked_meal', kind: 'food', label: 'Cooked meal' }], error: null } } });
    const { app } = buildApp({ admin });
    const res = await request(app).post('/api/listings').set(authed).send({ title: 'Dal', kind: 'food', category: 'cooked_meal' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('expiry_required');
  });
});

describe('messaging moderation', () => {
  const chat = { data: { id: 'c1', user_a: ALICE.id, user_b: BOB_ID }, error: null };
  const setup = (score) => {
    const user = fakeSupabase({ tables: { chats: chat } });
    const admin = adminWithAlice({
      rpc: { is_blocked: { data: false, error: null } },
      tables: { messages: (ops) => (ops.some(([op]) => op === 'insert')
        ? { data: { id: 9, body: 'x', flagged: score >= 0.8 }, error: null }
        : { data: null, error: null }) },
    });
    const ml = { moderateText: async () => (score == null ? null : { results: [{ label: 'toxic', score }], meta: {} }) };
    return buildApp({ admin, user, ml });
  };
  const send = (app) => request(app).post('/api/chats/33333333-3333-4333-8333-333333333333/messages').set(authed)
    .send({ body: 'hello', client_id: '44444444-4444-4444-8444-444444444444' });

  test('blocks clearly abusive messages', async () => {
    const res = await send(setup(0.97).app);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('message_blocked');
  });

  test('flags borderline messages and files a report', async () => {
    const { app, admin } = setup(0.85);
    const res = await send(app);
    expect(res.status).toBe(201);
    expect(res.body.message.flagged).toBe(true);
    expect(admin.log.some((c) => c.table === 'reports')).toBe(true);
  });

  test('sends normally when ML is unavailable', async () => {
    const res = await send(setup(null).app);
    expect(res.status).toBe(201);
    expect(res.body.message.flagged).toBe(false);
  });
});

describe('exchanges', () => {
  test('wrong pickup codes return attempts left', async () => {
    const user = fakeSupabase({ rpc: { complete_exchange: { data: { ok: false, error: 'invalid_code', attempts_left: 3 }, error: null } } });
    const { app } = buildApp({ admin: adminWithAlice(), user });
    const res = await request(app).post('/api/orders/33333333-3333-4333-8333-333333333333/complete').set(authed)
      .send({ code: '123456', idempotency_key: 'abcdefgh-1' });
    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/3 attempt/);
  });

  test('pickup codes are never cached', async () => {
    const user = fakeSupabase({ rpc: { issue_pickup_code: { data: { code: '123456' }, error: null } } });
    const { app } = buildApp({ admin: adminWithAlice(), user });
    const res = await request(app).post('/api/orders/33333333-3333-4333-8333-333333333333/pickup-code').set(authed);
    expect(res.headers['cache-control']).toBe('no-store');
  });
});

describe('AI features', () => {
  test('feed falls back to the heuristic ranker when ML is down', async () => {
    const candidates = [
      { listing_id: 'a', age_hours: 200, distance_km: 20, popularity: 0, exchange_mode: 'credits' },
      { listing_id: 'b', age_hours: 1, distance_km: 0.5, popularity: 5, exchange_mode: 'free', has_image: true },
    ];
    const admin = adminWithAlice({
      rpc: { recommend_candidates: { data: candidates, error: null } },
      tables: { listings: { data: [{ id: 'a', owner_id: BOB_ID }, { id: 'b', owner_id: BOB_ID }], error: null } },
    });
    const { app } = buildApp({ admin });
    const res = await request(app).get('/api/feed');
    expect(res.status).toBe(200);
    expect(res.body.model).toBe('heuristic');
    expect(res.body.items.map((i) => i.id)).toEqual(['b', 'a']);
  });

  test('feed uses the ML ranker when available', async () => {
    const admin = adminWithAlice({
      rpc: { recommend_candidates: { data: [{ listing_id: 'a' }, { listing_id: 'b' }], error: null } },
      tables: { listings: { data: [{ id: 'a' }, { id: 'b' }], error: null } },
    });
    const ml = { rank: async () => ({ scores: [{ listing_id: 'a', score: 0.9 }, { listing_id: 'b', score: 0.1 }], meta: { model: 'ranker', model_version: '3' } }) };
    const { app } = buildApp({ admin, ml });
    const res = await request(app).get('/api/feed');
    expect(res.body.model).toBe('ranker@3');
    expect(res.body.items[0].id).toBe('a');
  });

  test('listing suggestions are clamped to the taxonomy', async () => {
    const admin = adminWithAlice({ tables: { categories: { data: [{ slug: 'baked_goods', kind: 'food', label: 'Baked goods' }], error: null } } });
    const ml = { suggestListing: async () => ({
      suggestion: { title: 'x'.repeat(200), category: 'baked_goods', condition: 'mint', allergens: ['gluten', 4], est_weight_kg: -1 },
      meta: { model: 'vlm', prompt_version: 'listing_suggest.v1' },
    }) };
    const { app } = buildApp({ admin, ml });
    const res = await request(app).post('/api/ai/listing-suggest').set(authed)
      .send({ image_url: `https://proj.supabase.co/storage/v1/object/public/listing-images/${ALICE.id}/p.jpg` });
    expect(res.status).toBe(200);
    expect(res.body.suggestion).toMatchObject({ kind: 'food', category: 'baked_goods', condition: null, allergens: ['gluten'], est_weight_kg: null });
    expect(res.body.suggestion.title).toHaveLength(80);
  });

  test('AI suggest returns 503 when the model is unavailable', async () => {
    const admin = adminWithAlice({ tables: { categories: { data: [], error: null } } });
    const { app } = buildApp({ admin });
    const res = await request(app).post('/api/ai/listing-suggest').set(authed)
      .send({ image_url: `https://proj.supabase.co/storage/v1/object/public/listing-images/${ALICE.id}/p.jpg` });
    expect(res.status).toBe(503);
  });
});

describe('platform', () => {
  test('unknown routes return JSON 404', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('route_not_found');
  });

  test('CORS only allows configured origins', async () => {
    const { app } = buildApp();
    const ok = await request(app).get('/health').set('origin', 'http://localhost:8081');
    const bad = await request(app).get('/health').set('origin', 'https://evil.example');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:8081');
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });
});
