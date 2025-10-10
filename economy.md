# Audit Findings Summary

## Checklist Review (Short Answers)

- **Credit conversion during upload:**  
  Partially implemented but inconsistently enforced. The frontend (`AddScreen.tsx`) computes and writes `price_credits` directly to `itemdata` (client-side). Backend endpoints also compute `price_credits` on `POST/PUT`, but the frontend currently bypasses them on creation. Conversion logic exists but is duplicated and inconsistently applied.

- **Free donations reward:**  
  No code awards credits to donors for free donations. No logic found that grants credits for donating free items.

- **Balancing strategies:**  
  None of the listed mechanisms (supply control, sinks, rewards, anti-abuse, expiration, etc.) are implemented.

- **Rounding rule used:**  
  `Math.round(rupee/100)` is used in backend and frontend where conversions appear, so rounding policy is implemented in code where present.

---

### Detailed Audit

#### Credit Conversion During Product Upload

- **Frontend:**  
  - `AddScreen.tsx` computes:

    ```js
    rupeePrice = parseFloat(price)
    creditsPrice = rupeePrice ? Math.round(rupeePrice / 100) : 0
    ```

  - Inserts directly into Supabase:  
    `supabase.from('itemdata').insert([itemData])`  
    Conversion is performed on the client and saved to DB directly.

- **Backend:**  
  - `index.js` contains:
    - `POST /api/products` (server computes `price_credits = Math.round(safePrice / 100)` and inserts)
    - `PUT /api/products/:productId` updates `price_credits` server-side
  - Since frontend creation bypasses the backend, server-side enforcement is not guaranteed for items created by the app.

**Conclusion:**  
Conversion logic exists in both layers, but because the frontend directly inserts on create, server-side enforcement is not the single source of truth. This is a correctness & security issue (clients can send arbitrary `price_credits`).

---

#### Free Donations Credit Rewards

- No code found that grants credits upon donation or creation of free items.
- Endpoints exist to award initial credits to new users and to transfer credits manually, but nothing auto-credits donors on free item creation.

**Conclusion:**  
Donors do not receive credit rewards for donating free products.

---

#### Balancing Strategies & Economic Controls

- No code or SQL found implementing:
  - Credit supply management
  - Transaction fee sinks (beyond platform fee per sale)
  - Value pegging or conversion limits
  - Incentives/rewards
  - Anti-abuse measures (rate-limiting/verification)
  - Credit expiration, charity flows

**Conclusion:**  
None of these are implemented.

---

#### Rounding & Fee Policy

- Where conversions are implemented (`AddScreen`, backend), they use `Math.round`.
- Fee calculations use `Math.floor` for fee slices (backend deliver path uses `floor(credits * 0.02)`, `floor(credits * 0.03)`).
- This respects the selected policy (`Math.round`; fees in credits; allow 0-credit items).
- There is inconsistent usage of rupees vs credits in some payment code paths (notably `POST /api/orders/:orderId/pay-bill`), which uses rupee-based fields for credit transfers — this needs fixing.

---

#### Migrations & RPC Presence

- Migration files exist in `backend/migrations`, including the RPC `finalize_order`.
- Cannot verify if migrations are applied to your Supabase DB (previous `migrate:code` run failed with DNS error).
- Deliver endpoints that call `finalize_order` will fail until the RPC exists.

---

## Recommended Next Steps

### Immediate (High Priority)

- Change frontend `AddScreen.tsx` to call backend `POST /api/products` instead of inserting directly into Supabase. This centralizes conversion and validation.
- Fix `POST /api/orders/:orderId/pay-bill` to use credit fields (`amount_credits`, `platform_fee_credits`, `total_credits`) when creating `credit_stack` entries. Block operation if those columns are missing.

### High/Medium

- Apply SQL migrations (manually in Supabase SQL editor) so `price_credits` and `finalize_order` exist.
- Replace Supabase anon key in `index.js` with environment service role key and confirm credentials.

### Medium

- Add a "donation reward" mechanic: when a product is created with `type: 'free'` or `price = 0`, give the donor X credits via `credit_stack` entry. (Can be implemented as optional param or configurable rule.)

### Medium/Low (Longer-Term)

- Implement balancing mechanisms: credit sinks, dynamic fees, analytics, and anti-abuse measures.
