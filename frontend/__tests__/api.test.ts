/* eslint-disable import/first -- jest.mock calls must precede imports */
jest.mock('@/lib/config', () => ({ config: { apiUrl: 'http://api.test', supabaseUrl: 'http://sb.test', supabaseAnonKey: 'anon' } }));
const mockGetSession = jest.fn();
jest.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: () => mockGetSession() } } }));

import { api, ApiError, setUnauthorizedHandler } from '@/lib/api';
import { toPayload, validateDraft, type ListingDraft } from '@/features/listings/draft';

const json = (status: number, body: unknown) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });

beforeEach(() => {
  mockGetSession.mockResolvedValue({ data: { session: { access_token: 'tok-123' } } });
  (globalThis as any).fetch = jest.fn();
});

describe('api client', () => {
  it('attaches the current access token and builds the query string', async () => {
    (fetch as jest.Mock).mockReturnValue(json(200, { ok: true }));
    await api('/listings', { query: { kind: 'food', q: undefined, limit: 20 } });
    const [url, init] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('http://api.test/api/listings?kind=food&limit=20');
    expect(init.headers.authorization).toBe('Bearer tok-123');
  });

  it('turns error payloads into ApiError with the server code', async () => {
    (fetch as jest.Mock).mockReturnValue(json(409, { error: { code: 'insufficient_credits', message: 'Not enough available credits.' } }));
    await expect(api('/credits/transfer', { method: 'POST', body: {} })).rejects.toMatchObject({
      status: 409, code: 'insufficient_credits', message: 'Not enough available credits.',
    });
  });

  it('notifies the auth layer on 401', async () => {
    const handler = jest.fn();
    setUnauthorizedHandler(handler);
    (fetch as jest.Mock).mockReturnValue(json(401, { error: { code: 'not_authenticated', message: 'Please sign in.' } }));
    await expect(api('/me')).rejects.toBeInstanceOf(ApiError);
    expect(handler).toHaveBeenCalled();
  });

  it('reports network failures clearly', async () => {
    (fetch as jest.Mock).mockRejectedValue(new TypeError('Network request failed'));
    await expect(api('/me')).rejects.toMatchObject({ code: 'network_error' });
  });

  it('omits the token for public calls', async () => {
    (fetch as jest.Mock).mockReturnValue(json(200, {}));
    await api('/categories', { auth: false });
    expect((fetch as jest.Mock).mock.calls[0][1].headers.authorization).toBeUndefined();
  });
});

describe('listing form', () => {
  const base: ListingDraft = {
    images: [], kind: 'food', category: 'cooked_meal', title: 'Veg pulao', description: '', condition: null,
    exchange_mode: 'free', price: '', quantity_label: '3 portions', allergens: ['dairy'], dietary_tags: [], shelf_hours: 12,
    expires_at: null, storage_info: '', pickup: 'today', neighborhood: 'Sector 21', ai_assisted: true, est_weight_kg: null,
  };

  it('requires a condition for non-food and a price for credit listings', () => {
    expect(validateDraft({ ...base, kind: 'non_food', category: 'books' })).toHaveProperty('condition');
    expect(validateDraft({ ...base, exchange_mode: 'credits', price: '0' })).toHaveProperty('price');
    expect(validateDraft(base)).toEqual({});
  });

  it('builds a payload with expiry and no food fields for items', () => {
    const food = toPayload(base);
    expect(food.expires_at).not.toBeNull();
    expect(food.price_credits).toBe(0);
    const item = toPayload({ ...base, kind: 'non_food', category: 'books', condition: 'good', exchange_mode: 'credits', price: '15' });
    expect(item).toMatchObject({ expires_at: null, allergens: [], condition: 'good', price_credits: 15 });
  });
});
