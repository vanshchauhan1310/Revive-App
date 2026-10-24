-- Row Level Security. Default deny: every table has RLS on, and clients get only the
-- policies below. Writes that need business rules go through the backend (service role,
-- always scoped to the verified user) or through the SECURITY DEFINER RPCs in 0002.

alter table public.categories          enable row level security;
alter table public.app_config          enable row level security;
alter table public.profiles            enable row level security;
alter table public.blocks              enable row level security;
alter table public.wallets             enable row level security;
alter table public.credit_ledger       enable row level security;
alter table public.listings            enable row level security;
alter table public.listing_embeddings  enable row level security;
alter table public.saved_listings      enable row level security;
alter table public.orders              enable row level security;
alter table public.settlements         enable row level security;
alter table public.chats               enable row level security;
alter table public.messages            enable row level security;
alter table public.chat_reads          enable row level security;
alter table public.notifications       enable row level security;
alter table public.reports             enable row level security;
alter table public.interactions        enable row level security;
alter table public.ml_predictions      enable row level security;

-- Reference data
create policy categories_read on public.categories for select using (true);
create policy app_config_read on public.app_config for select
  using (key in ('signup_bonus_credits', 'platform_fee_bps', 'otp_ttl_minutes'));

-- Profiles: private row visible to its owner (and admins). Others use public_profiles.
create policy profiles_self_read on public.profiles for select
  using (id = auth.uid() or public.is_admin());
create policy profiles_self_update on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

create policy blocks_own on public.blocks for all
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

-- Credits: read-only history for the owner. No client writes at all.
create policy wallets_own on public.wallets for select using (user_id = auth.uid());
create policy ledger_own on public.credit_ledger for select using (account_id = auth.uid());

-- Requesters keep access to a listing after it is reserved/completed. SECURITY DEFINER so
-- the policy works for roles without direct access to orders.
create function public.requested_by_me(p_listing uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
     and exists (select 1 from public.orders o where o.listing_id = p_listing and o.requester_id = auth.uid())
$$;

-- Listings: anyone may browse available ones; owners and order participants see theirs.
create policy listings_public_read on public.listings for select
  using (
    (status = 'available' and (expires_at is null or expires_at > now()))
    or owner_id = auth.uid()
    or public.is_admin()
    or public.requested_by_me(id)
  );

create policy saved_own on public.saved_listings for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Orders & settlements: participants only. Transitions only via RPCs.
create policy orders_participants on public.orders for select
  using (auth.uid() in (requester_id, owner_id) or public.is_admin());
create policy settlements_participants on public.settlements for select
  using (exists (select 1 from public.orders o
                 where o.id = settlements.order_id and auth.uid() in (o.requester_id, o.owner_id)));

-- Messaging: participants only.
create policy chats_participants on public.chats for select
  using (auth.uid() in (user_a, user_b));
create policy messages_participants on public.messages for select
  using (exists (select 1 from public.chats c
                 where c.id = messages.chat_id and auth.uid() in (c.user_a, c.user_b)));
create policy chat_reads_own on public.chat_reads for select using (user_id = auth.uid());

-- Notifications: recipient only.
create policy notifications_own on public.notifications for select using (user_id = auth.uid());

-- Reports: reporters see their own; admins see all.
create policy reports_own on public.reports for select
  using (reporter_id = auth.uid() or public.is_admin());

-- listing_embeddings, interactions, ml_predictions: no client policies (service role only).

-- ---------------------------------------------------------------------------
-- Column-level privileges
-- ---------------------------------------------------------------------------
revoke insert, update, delete on all tables in schema public from anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
-- Profiles: only safe fields are self-editable (role, reliability_score, deleted_at are not).
grant update (display_name, avatar_url, phone, neighborhood, lat, lng, notification_prefs)
  on public.profiles to authenticated;
grant insert, delete on public.saved_listings, public.blocks to authenticated;
-- The pickup-code hash must never reach clients (a 6-digit code is brute-forceable offline).
revoke select on public.orders from anon, authenticated;
grant select (id, listing_id, requester_id, owner_id, status, message, listing_title, price_credits,
              fee_credits, held_credits, otp_expires_at, otp_attempts, cancelled_by, cancel_reason,
              impact_kg_co2e, impact_kg_waste, accepted_at, ready_at, completed_at, closed_at,
              created_at, updated_at)
  on public.orders to authenticated;

-- Training/reconciliation views bypass RLS (owner rights): never expose them to clients.
revoke all on public.ml_order_outcomes, public.wallet_reconciliation from anon, authenticated;
grant select on public.public_profiles to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Function privileges: revoke the PUBLIC default, then grant user-facing RPCs only.
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.transfer_credits(uuid, bigint, text),
  public.request_listing(uuid, text),
  public.respond_order(uuid, boolean),
  public.mark_ready(uuid),
  public.issue_pickup_code(uuid),
  public.complete_exchange(uuid, text, text),
  public.cancel_order(uuid, text),
  public.open_dispute(uuid, text),
  public.admin_resolve_dispute(uuid, boolean),
  public.get_or_create_chat(uuid, uuid),
  public.mark_chat_read(uuid, bigint),
  public.my_inbox(),
  public.similar_listings(uuid, int)
to authenticated;

-- The backend's service role runs jobs (expire_stale, recommend_candidates, ...).
grant all on all tables in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Helpers referenced inside RLS policies / generated columns must be callable.
grant execute on function public.is_admin(uuid), public.requested_by_me(uuid), public.haversine_km(float8, float8, float8, float8)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime (Supabase only): stream new messages, notifications and order changes.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages, public.notifications, public.orders;
  end if;
end $$;
