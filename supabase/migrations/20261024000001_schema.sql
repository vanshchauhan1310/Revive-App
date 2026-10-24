-- EcoShare core schema.
-- Conventions:
--   * Every user-owned row references profiles.id, which equals auth.users.id.
--   * Credits are whole integers. Balances only change through credit_ledger.
--   * Clients read through RLS; writes go through the backend or SECURITY DEFINER RPCs.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------
create table public.categories (
  slug        text primary key,
  kind        text not null check (kind in ('food', 'non_food')),
  label       text not null,
  sort_order  int  not null default 0
);

insert into public.categories (slug, kind, label, sort_order) values
  ('cooked_meal',   'food',     'Cooked meal',        10),
  ('baked_goods',   'food',     'Baked goods',        20),
  ('produce',       'food',     'Fruit & vegetables', 30),
  ('dairy',         'food',     'Dairy & eggs',       40),
  ('packaged_food', 'food',     'Packaged food',      50),
  ('beverages',     'food',     'Beverages',          60),
  ('clothing',      'non_food', 'Clothing',           110),
  ('books',         'non_food', 'Books & stationery', 120),
  ('electronics',   'non_food', 'Electronics',        130),
  ('furniture',     'non_food', 'Furniture',          140),
  ('kitchenware',   'non_food', 'Kitchenware',        150),
  ('toys',          'non_food', 'Toys & kids',        160),
  ('sports',        'non_food', 'Sports & outdoors',  170),
  ('other',         'non_food', 'Other',              900);

create table public.app_config (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.app_config (key, value) values
  ('signup_bonus_credits', '100'),
  ('platform_fee_bps',     '200'),   -- 2.00 %, rounded up to whole credits
  ('otp_ttl_minutes',      '30'),
  ('otp_max_attempts',     '5'),
  ('request_ttl_hours',    '72'),
  ('pickup_ttl_hours',     '168'),
  ('moderation_threshold', '0.80');

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  display_name        text not null default '' check (char_length(display_name) <= 80),
  avatar_url          text,
  phone               text,
  neighborhood        text check (char_length(neighborhood) <= 120),
  lat                 double precision check (lat between -90 and 90),
  lng                 double precision check (lng between -180 and 180),
  notification_prefs  jsonb not null default '{"orders": true, "messages": true}'::jsonb,
  role                text not null default 'user' check (role in ('user', 'admin')),
  reliability_score   numeric(4, 3),             -- written by the ML risk model
  deleted_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Fields any signed-in user may see about another user.
create view public.public_profiles as
  select id, display_name, avatar_url, neighborhood, reliability_score, created_at
  from public.profiles
  where deleted_at is null;

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- ---------------------------------------------------------------------------
-- Credits: wallets + append-only double-entry ledger.
-- account_id NULL is the platform account.
-- ---------------------------------------------------------------------------
create table public.wallets (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  balance    bigint not null default 0 check (balance >= 0),
  held       bigint not null default 0 check (held >= 0),
  updated_at timestamptz not null default now(),
  check (held <= balance)
);

create table public.credit_ledger (
  id          bigint generated always as identity primary key,
  tx_id       uuid   not null,
  account_id  uuid   references public.profiles (id) on delete set null,
  amount      bigint not null check (amount <> 0),
  kind        text   not null check (kind in
                ('signup_bonus', 'transfer', 'purchase', 'sale', 'fee', 'reversal', 'adjustment')),
  order_id    uuid,
  description text   check (char_length(description) <= 200),
  created_at  timestamptz not null default now()
);
create index credit_ledger_account_idx on public.credit_ledger (account_id, created_at desc);
create index credit_ledger_tx_idx on public.credit_ledger (tx_id);
create unique index credit_ledger_one_signup_bonus
  on public.credit_ledger (account_id) where kind = 'signup_bonus';

-- ---------------------------------------------------------------------------
-- Listings
-- ---------------------------------------------------------------------------
create table public.listings (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid not null references public.profiles (id) on delete cascade,
  title                text not null check (char_length(title) between 3 and 80),
  description          text not null default '' check (char_length(description) <= 2000),
  kind                 text not null check (kind in ('food', 'non_food')),
  category             text not null references public.categories (slug),
  condition            text check (condition in ('new', 'like_new', 'good', 'fair')),
  exchange_mode        text not null default 'free' check (exchange_mode in ('free', 'credits')),
  price_credits        int  not null default 0 check (price_credits >= 0 and price_credits <= 100000),
  quantity_label       text check (char_length(quantity_label) <= 60),   -- e.g. "4 portions"
  images               text[] not null default '{}' check (cardinality(images) <= 4),
  neighborhood         text check (char_length(neighborhood) <= 120),
  lat                  double precision check (lat between -90 and 90),
  lng                  double precision check (lng between -180 and 180),
  -- Food-specific
  allergens            text[] not null default '{}',
  dietary_tags         text[] not null default '{}',
  prepared_at          timestamptz,
  expires_at           timestamptz,
  storage_info         text check (char_length(storage_info) <= 200),
  -- Collection window
  pickup_start         timestamptz,
  pickup_end           timestamptz,
  -- Lifecycle
  status               text not null default 'available' check (status in
                         ('pending_review', 'available', 'reserved', 'completed', 'archived', 'removed')),
  moderation           jsonb,
  ai_assisted          boolean not null default false,
  est_weight_kg        numeric(8, 3),
  search               tsvector generated always as (
                         setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
                         setweight(to_tsvector('simple', coalesce(description, '')), 'B')
                       ) stored,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  check ((exchange_mode = 'free' and price_credits = 0) or (exchange_mode = 'credits' and price_credits > 0)),
  check (kind = 'food' or condition is not null),
  check (pickup_end is null or pickup_start is null or pickup_end > pickup_start)
);
create index listings_discover_idx on public.listings (status, kind, created_at desc);
create index listings_owner_idx on public.listings (owner_id, created_at desc);
create index listings_search_idx on public.listings using gin (search);

create table public.listing_embeddings (
  listing_id uuid primary key references public.listings (id) on delete cascade,
  embedding  vector(384) not null,
  model      text not null,
  updated_at timestamptz not null default now()
);
create index listing_embeddings_hnsw on public.listing_embeddings using hnsw (embedding vector_cosine_ops);

create table public.saved_listings (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

-- ---------------------------------------------------------------------------
-- Exchanges (orders)
--   requested -> accepted -> ready_for_pickup -> completed
--   requested -> declined | cancelled | expired
--   accepted / ready_for_pickup -> cancelled | expired | disputed
--   completed -> disputed
-- ---------------------------------------------------------------------------
create table public.orders (
  id               uuid primary key default gen_random_uuid(),
  listing_id       uuid not null references public.listings (id) on delete restrict,
  requester_id     uuid not null references public.profiles (id),
  owner_id         uuid not null references public.profiles (id),
  status           text not null default 'requested' check (status in
                     ('requested', 'accepted', 'ready_for_pickup', 'completed',
                      'declined', 'cancelled', 'expired', 'disputed')),
  message          text check (char_length(message) <= 500),
  -- Snapshot taken at acceptance so later listing edits cannot change the bill
  listing_title    text not null,
  price_credits    int  not null default 0 check (price_credits >= 0),
  fee_credits      int  not null default 0 check (fee_credits >= 0),
  held_credits     bigint not null default 0 check (held_credits >= 0),
  -- Pickup code (hash only; the requester reveals the code at handover)
  otp_hash         text,
  otp_expires_at   timestamptz,
  otp_attempts     int  not null default 0,
  -- Outcome
  cancelled_by     uuid references public.profiles (id),
  cancel_reason    text check (cancel_reason in ('changed_mind', 'no_show', 'item_unavailable', 'other')),
  impact_kg_co2e   numeric(10, 3),
  impact_kg_waste  numeric(10, 3),
  accepted_at      timestamptz,
  ready_at         timestamptz,
  completed_at     timestamptz,
  closed_at        timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (requester_id <> owner_id)
);
create index orders_requester_idx on public.orders (requester_id, created_at desc);
create index orders_owner_idx on public.orders (owner_id, created_at desc);
-- A requester has at most one open request per listing
create unique index orders_one_open_request
  on public.orders (listing_id, requester_id)
  where status in ('requested', 'accepted', 'ready_for_pickup');
-- A listing has at most one reservation, and is completed at most once
create unique index orders_one_reservation
  on public.orders (listing_id)
  where status in ('accepted', 'ready_for_pickup', 'completed', 'disputed');

create table public.settlements (
  order_id        uuid primary key references public.orders (id),
  idempotency_key text not null unique,
  tx_id           uuid,
  total_credits   bigint not null,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Messaging: one conversation per (listing, pair of users)
-- ---------------------------------------------------------------------------
create table public.chats (
  id                   uuid primary key default gen_random_uuid(),
  listing_id           uuid references public.listings (id) on delete set null,
  user_a               uuid not null references public.profiles (id) on delete cascade,
  user_b               uuid not null references public.profiles (id) on delete cascade,
  listing_title        text,
  last_message_at      timestamptz,
  last_message_preview text,
  created_at           timestamptz not null default now(),
  check (user_a < user_b)
);
create unique index chats_unique_thread
  on public.chats (coalesce(listing_id, '00000000-0000-0000-0000-000000000000'::uuid), user_a, user_b);
create index chats_user_a_idx on public.chats (user_a, last_message_at desc);
create index chats_user_b_idx on public.chats (user_b, last_message_at desc);

create table public.messages (
  id          bigint generated always as identity primary key,
  chat_id     uuid not null references public.chats (id) on delete cascade,
  sender_id   uuid not null references public.profiles (id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 2000),
  client_id   uuid not null,
  flagged     boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (sender_id, client_id)
);
create index messages_chat_idx on public.messages (chat_id, id desc);

create table public.chat_reads (
  chat_id      uuid not null references public.chats (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  last_read_id bigint not null default 0,
  primary key (chat_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Notifications, reports
-- ---------------------------------------------------------------------------
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  type        text not null,
  title       text not null,
  body        text not null default '',
  order_id    uuid references public.orders (id) on delete cascade,
  listing_id  uuid references public.listings (id) on delete cascade,
  chat_id     uuid references public.chats (id) on delete cascade,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid references public.profiles (id) on delete set null,   -- null = automated (ML)
  target_type  text not null check (target_type in ('listing', 'message', 'user', 'order')),
  target_id    text not null,
  reason       text not null check (reason in
                 ('unsafe_food', 'prohibited_item', 'harassment', 'spam', 'scam', 'no_show',
                  'inappropriate', 'dispute', 'other')),
  details      text check (char_length(details) <= 1000),
  source       text not null default 'user' check (source in ('user', 'ml')),
  score        numeric(5, 4),
  status       text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  resolved_by  uuid references public.profiles (id),
  created_at   timestamptz not null default now()
);
create index reports_open_idx on public.reports (status, created_at desc);

-- ---------------------------------------------------------------------------
-- ML / MLOps tables
-- ---------------------------------------------------------------------------
create table public.interactions (
  id          bigint generated always as identity primary key,
  user_id     uuid references public.profiles (id) on delete set null,
  listing_id  uuid references public.listings (id) on delete cascade,
  event       text not null check (event in
                ('impression', 'view', 'save', 'unsave', 'request', 'chat', 'complete', 'dismiss')),
  context     jsonb not null default '{}'::jsonb,     -- e.g. {"surface":"for_you","rank":3,"model":"ranker@3"}
  created_at  timestamptz not null default now()
);
create index interactions_user_idx on public.interactions (user_id, created_at desc);
create index interactions_listing_idx on public.interactions (listing_id, event);

create table public.ml_predictions (
  id              bigint generated always as identity primary key,
  task            text not null,          -- listing_suggest | moderate_text | moderate_image | rank | risk | impact | embed
  model           text not null,
  model_version   text,
  prompt_version  text,
  input_hash      text,
  output          jsonb,
  latency_ms      int,
  fallback        boolean not null default false,
  error           text,
  user_id         uuid references public.profiles (id) on delete set null,
  listing_id      uuid references public.listings (id) on delete set null,
  created_at      timestamptz not null default now()
);
create index ml_predictions_task_idx on public.ml_predictions (task, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger listings_touch before update on public.listings
  for each row execute function public.touch_updated_at();
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();
create trigger wallets_touch before update on public.wallets
  for each row execute function public.touch_updated_at();
