-- EcoShare business rules that must hold under concurrency live here, inside the database.
-- Every RPC that acts for a user derives identity from auth.uid(), never from arguments.
-- Errors are raised with stable, machine-readable messages (e.g. 'listing_unavailable')
-- which the backend maps to HTTP responses.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create function public.cfg_int(p_key text) returns bigint
language sql stable as $$
  select (value #>> '{}')::bigint from public.app_config where key = p_key
$$;

create function public.cfg_num(p_key text) returns numeric
language sql stable as $$
  select (value #>> '{}')::numeric from public.app_config where key = p_key
$$;

create function public.require_uid() returns uuid
language plpgsql stable as $$
declare
  v uuid := auth.uid();
begin
  if v is null then
    raise exception 'not_authenticated';
  end if;
  return v;
end $$;

create function public.is_admin(p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.profiles where id = p_uid and role = 'admin')
$$;

create function public.is_blocked(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = p_a and blocked_id = p_b) or (blocker_id = p_b and blocked_id = p_a)
  )
$$;

create function public.haversine_km(lat1 float8, lng1 float8, lat2 float8, lng2 float8) returns float8
language sql immutable as $$
  select case when lat1 is null or lng1 is null or lat2 is null or lng2 is null then null
  else 2 * 6371 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  )) end
$$;

create function public.platform_fee(p_price bigint) returns bigint
language sql stable as $$
  select case when p_price <= 0 then 0
         else ceil(p_price * public.cfg_int('platform_fee_bps') / 10000.0)::bigint end
$$;

create function public.notify(
  p_user uuid, p_type text, p_title text, p_body text,
  p_order uuid default null, p_listing uuid default null, p_chat uuid default null
) returns void
language sql security definer set search_path = public, extensions as $$
  insert into public.notifications (user_id, type, title, body, order_id, listing_id, chat_id)
  values (p_user, p_type, p_title, p_body, p_order, p_listing, p_chat)
$$;

-- ---------------------------------------------------------------------------
-- Ledger: append-only; wallet balances follow ledger inserts.
-- ---------------------------------------------------------------------------
create function public.ledger_apply() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.account_id is not null then
    update public.wallets set balance = balance + new.amount where user_id = new.account_id;
    if not found then
      raise exception 'wallet_missing';
    end if;
  end if;
  return new;
end $$;

create trigger credit_ledger_apply after insert on public.credit_ledger
  for each row execute function public.ledger_apply();

create function public.ledger_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'ledger_is_append_only';
end $$;

create trigger credit_ledger_no_update before update or delete on public.credit_ledger
  for each row execute function public.ledger_immutable();

-- Every transaction must sum to zero across accounts (platform = NULL account).
create function public.ledger_post(p_tx uuid, p_entries jsonb) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  e jsonb;
  total bigint := 0;
begin
  for e in select * from jsonb_array_elements(p_entries) loop
    total := total + (e->>'amount')::bigint;
  end loop;
  if total <> 0 then
    raise exception 'ledger_unbalanced';
  end if;
  insert into public.credit_ledger (tx_id, account_id, amount, kind, order_id, description)
  select p_tx, nullif(x->>'account_id', '')::uuid, (x->>'amount')::bigint, x->>'kind',
         nullif(x->>'order_id', '')::uuid, x->>'description'
  from jsonb_array_elements(p_entries) x;
  return p_tx;
end $$;

-- Wallets whose balance disagrees with the ledger (should always be empty).
create view public.wallet_reconciliation as
  select w.user_id, w.balance, coalesce(l.total, 0) as ledger_total, w.balance - coalesce(l.total, 0) as drift
  from public.wallets w
  left join (select account_id, sum(amount) as total from public.credit_ledger group by account_id) l
    on l.account_id = w.user_id
  where w.balance <> coalesce(l.total, 0);

-- ---------------------------------------------------------------------------
-- Signup: profile + wallet + one-time bonus, created from the verified auth user.
-- ---------------------------------------------------------------------------
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  bonus bigint := coalesce(public.cfg_int('signup_bonus_credits'), 0);
  name text := coalesce(nullif(new.raw_user_meta_data->>'name', ''),
                        nullif(new.raw_user_meta_data->>'full_name', ''),
                        split_part(coalesce(new.email, ''), '@', 1));
begin
  insert into public.profiles (id, display_name) values (new.id, left(coalesce(name, ''), 80))
  on conflict (id) do nothing;
  insert into public.wallets (user_id) values (new.id) on conflict (user_id) do nothing;
  if bonus > 0 then
    perform public.ledger_post(gen_random_uuid(), jsonb_build_array(
      jsonb_build_object('account_id', null,   'amount', -bonus, 'kind', 'signup_bonus', 'description', 'Welcome bonus'),
      jsonb_build_object('account_id', new.id, 'amount',  bonus, 'kind', 'signup_bonus', 'description', 'Welcome bonus')
    ));
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Credits
-- ---------------------------------------------------------------------------
create function public.transfer_credits(p_recipient uuid, p_amount bigint, p_note text default null)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  uid uuid := public.require_uid();
  w public.wallets;
  tx uuid := gen_random_uuid();
begin
  if p_amount is null or p_amount <= 0 or p_amount > 100000 then
    raise exception 'invalid_amount';
  end if;
  if p_recipient is null or p_recipient = uid then
    raise exception 'invalid_recipient';
  end if;
  if not exists (select 1 from public.profiles where id = p_recipient and deleted_at is null) then
    raise exception 'invalid_recipient';
  end if;
  if public.is_blocked(uid, p_recipient) then
    raise exception 'blocked';
  end if;

  select * into w from public.wallets where user_id = uid for update;
  if w.balance - w.held < p_amount then
    raise exception 'insufficient_credits';
  end if;

  perform public.ledger_post(tx, jsonb_build_array(
    jsonb_build_object('account_id', uid,         'amount', -p_amount, 'kind', 'transfer', 'description', left(p_note, 200)),
    jsonb_build_object('account_id', p_recipient, 'amount',  p_amount, 'kind', 'transfer', 'description', left(p_note, 200))
  ));
  perform public.notify(p_recipient, 'credits_received', 'Credits received',
                        p_amount || ' credits were sent to you.');
  return tx;
end $$;

-- ---------------------------------------------------------------------------
-- Exchange lifecycle
-- ---------------------------------------------------------------------------
create function public.request_listing(p_listing uuid, p_message text default null)
returns public.orders
language plpgsql security definer set search_path = public, extensions as $$
declare
  uid uuid := public.require_uid();
  l public.listings;
  o public.orders;
begin
  select * into l from public.listings where id = p_listing for share;
  if not found or l.status <> 'available' or (l.expires_at is not null and l.expires_at <= now()) then
    raise exception 'listing_unavailable';
  end if;
  if l.owner_id = uid then
    raise exception 'cannot_request_own_listing';
  end if;
  if public.is_blocked(uid, l.owner_id) then
    raise exception 'blocked';
  end if;

  begin
    insert into public.orders (listing_id, requester_id, owner_id, message, listing_title,
                               price_credits, fee_credits)
    values (l.id, uid, l.owner_id, left(p_message, 500), l.title,
            l.price_credits, public.platform_fee(l.price_credits))
    returning * into o;
  exception when unique_violation then
    raise exception 'already_requested';
  end;

  perform public.notify(l.owner_id, 'order_requested', 'New request',
                        'Someone would like "' || l.title || '".', o.id, l.id);
  insert into public.interactions (user_id, listing_id, event) values (uid, l.id, 'request');
  return o;
end $$;

create function public.respond_order(p_order uuid, p_accept boolean)
returns public.orders
language plpgsql security definer set search_path = public, extensions as $$
declare
  uid uuid := public.require_uid();
  o public.orders;
  l public.listings;
  w public.wallets;
  v_price bigint;
  v_fee bigint;
  other record;
begin
  select * into o from public.orders where id = p_order for update;
  if not found or o.owner_id <> uid then
    raise exception 'order_not_found';
  end if;
  if o.status <> 'requested' then
    raise exception 'invalid_transition';
  end if;

  if not p_accept then
    update public.orders set status = 'declined', closed_at = now() where id = o.id returning * into o;
    perform public.notify(o.requester_id, 'order_declined', 'Request declined',
                          'Your request for "' || o.listing_title || '" was declined.', o.id, o.listing_id);
    return o;
  end if;

  select * into l from public.listings where id = o.listing_id for update;
  if l.status <> 'available' or (l.expires_at is not null and l.expires_at <= now()) then
    raise exception 'listing_unavailable';
  end if;

  -- Snapshot price and fee now; hold the requester's credits until handover.
  v_price := l.price_credits;
  v_fee := public.platform_fee(v_price);
  if v_price + v_fee > 0 then
    select * into w from public.wallets where user_id = o.requester_id for update;
    if w.balance - w.held < v_price + v_fee then
      raise exception 'insufficient_credits';
    end if;
    update public.wallets set held = held + v_price + v_fee where user_id = o.requester_id;
  end if;

  update public.listings set status = 'reserved' where id = l.id;
  update public.orders
     set status = 'accepted', accepted_at = now(), listing_title = l.title,
         price_credits = v_price, fee_credits = v_fee, held_credits = v_price + v_fee
   where id = o.id
  returning * into o;

  perform public.notify(o.requester_id, 'order_accepted', 'Request accepted',
                        '"' || o.listing_title || '" is reserved for you. Arrange pickup in chat.', o.id, o.listing_id);

  -- Single-unit listing: every other open request is declined.
  for other in
    update public.orders set status = 'declined', closed_at = now()
     where listing_id = l.id and id <> o.id and status = 'requested'
    returning id, requester_id
  loop
    perform public.notify(other.requester_id, 'order_declined', 'Item no longer available',
                          '"' || o.listing_title || '" was given to someone else.', other.id, l.id);
  end loop;
  return o;
end $$;

create function public.mark_ready(p_order uuid)
returns public.orders
language plpgsql security definer set search_path = public, extensions as $$
declare
  uid uuid := public.require_uid();
  o public.orders;
begin
  select * into o from public.orders where id = p_order for update;
  if not found or o.owner_id <> uid then
    raise exception 'order_not_found';
  end if;
  if o.status <> 'accepted' then
    raise exception 'invalid_transition';
  end if;
  update public.orders set status = 'ready_for_pickup', ready_at = now() where id = o.id returning * into o;
  perform public.notify(o.requester_id, 'order_ready', 'Ready for pickup',
                        'Open the exchange to show your pickup code at handover.', o.id, o.listing_id);
  return o;
end $$;

-- The requester reveals this code to the owner at handover. Only its hash is stored;
-- issuing a new code invalidates the previous one and resets attempts.
create function public.issue_pickup_code(p_order uuid)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  uid uuid := public.require_uid();
  o public.orders;
  b bytea := gen_random_bytes(4);
  code text;
  expires timestamptz := now() + make_interval(mins => public.cfg_int('otp_ttl_minutes')::int);
begin
  select * into o from public.orders where id = p_order for update;
  if not found or o.requester_id <> uid then
    raise exception 'order_not_found';
  end if;
  if o.status <> 'ready_for_pickup' then
    raise exception 'invalid_transition';
  end if;
  code := lpad(((get_byte(b, 0)::bigint * 16777216 + get_byte(b, 1) * 65536
                 + get_byte(b, 2) * 256 + get_byte(b, 3)) % 1000000)::text, 6, '0');
  update public.orders
     set otp_hash = crypt(code, gen_salt('bf', 6)), otp_expires_at = expires, otp_attempts = 0
   where id = o.id;
  return jsonb_build_object('code', code, 'expires_at', expires);
end $$;

-- Owner enters the code shown by the requester. Verification, settlement and completion
-- happen in one transaction. Wrong codes return {ok:false} (not an exception) so the
-- attempt counter is persisted.
create function public.complete_exchange(p_order uuid, p_code text, p_idempotency_key text)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  uid uuid := public.require_uid();
  o public.orders;
  s public.settlements;
  tx uuid;
  max_attempts int := public.cfg_int('otp_max_attempts')::int;
  entries jsonb;
begin
  if p_idempotency_key is null or char_length(p_idempotency_key) < 8 then
    raise exception 'idempotency_key_required';
  end if;

  select * into o from public.orders where id = p_order for update;
  if not found or o.owner_id <> uid then
    raise exception 'order_not_found';
  end if;

  select * into s from public.settlements where order_id = o.id;
  if found then
    if s.idempotency_key = p_idempotency_key then
      return jsonb_build_object('ok', true, 'replayed', true, 'order_id', o.id, 'tx_id', s.tx_id);
    end if;
    raise exception 'already_completed';
  end if;

  if o.status <> 'ready_for_pickup' then
    raise exception 'invalid_transition';
  end if;
  if o.otp_hash is null or o.otp_expires_at is null or o.otp_expires_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'code_expired');
  end if;
  if o.otp_attempts >= max_attempts then
    return jsonb_build_object('ok', false, 'error', 'too_many_attempts');
  end if;
  if p_code is null or crypt(p_code, o.otp_hash) <> o.otp_hash then
    update public.orders set otp_attempts = otp_attempts + 1 where id = o.id;
    return jsonb_build_object('ok', false, 'error', 'invalid_code',
                              'attempts_left', greatest(max_attempts - o.otp_attempts - 1, 0));
  end if;

  if o.held_credits > 0 then
    tx := gen_random_uuid();
    perform 1 from public.wallets where user_id = o.requester_id for update;
    update public.wallets set held = held - o.held_credits where user_id = o.requester_id;
    entries := jsonb_build_array(
      jsonb_build_object('account_id', o.requester_id, 'amount', -o.held_credits, 'kind', 'purchase',
                         'order_id', o.id, 'description', left(o.listing_title, 200)),
      jsonb_build_object('account_id', o.owner_id, 'amount', o.price_credits, 'kind', 'sale',
                         'order_id', o.id, 'description', left(o.listing_title, 200)));
    if o.fee_credits > 0 then
      entries := entries || jsonb_build_array(
        jsonb_build_object('account_id', null, 'amount', o.fee_credits, 'kind', 'fee',
                           'order_id', o.id, 'description', 'Platform fee'));
    end if;
    perform public.ledger_post(tx, entries);
  end if;

  insert into public.settlements (order_id, idempotency_key, tx_id, total_credits)
  values (o.id, p_idempotency_key, tx, o.held_credits);

  update public.orders
     set status = 'completed', completed_at = now(), closed_at = now(),
         otp_hash = null, otp_expires_at = null, held_credits = 0
   where id = o.id;
  update public.listings set status = 'completed' where id = o.listing_id;

  insert into public.interactions (user_id, listing_id, event) values (o.requester_id, o.listing_id, 'complete');
  perform public.notify(o.requester_id, 'order_completed', 'Exchange complete',
                        'Enjoy "' || o.listing_title || '"! Thanks for sharing.', o.id, o.listing_id);
  perform public.notify(o.owner_id, 'order_completed', 'Exchange complete',
                        case when o.price_credits > 0
                             then o.price_credits || ' credits added to your wallet.'
                             else 'Thanks for sharing "' || o.listing_title || '".' end,
                        o.id, o.listing_id);
  return jsonb_build_object('ok', true, 'replayed', false, 'order_id', o.id, 'tx_id', tx);
end $$;

-- Internal: release a hold and reopen the listing when an active order ends without completion.
create function public.close_order_unfulfilled(o public.orders) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if o.held_credits > 0 then
    update public.wallets set held = held - o.held_credits where user_id = o.requester_id;
    update public.orders set held_credits = 0 where id = o.id;
  end if;
  if o.status in ('accepted', 'ready_for_pickup', 'disputed') then
    update public.listings
       set status = case when expires_at is not null and expires_at <= now() then 'archived' else 'available' end
     where id = o.listing_id and status = 'reserved';
  end if;
end $$;

create function public.cancel_order(p_order uuid, p_reason text default 'other')
returns public.orders
language plpgsql security definer set search_path = public, extensions as $$
declare
  uid uuid := public.require_uid();
  o public.orders;
  other uuid;
begin
  select * into o from public.orders where id = p_order for update;
  if not found or uid not in (o.requester_id, o.owner_id) then
    raise exception 'order_not_found';
  end if;
  if not (
    (uid = o.requester_id and o.status in ('requested', 'accepted', 'ready_for_pickup')) or
    (uid = o.owner_id and o.status in ('accepted', 'ready_for_pickup'))
  ) then
    raise exception 'invalid_transition';
  end if;
  if p_reason not in ('changed_mind', 'no_show', 'item_unavailable', 'other') then
    raise exception 'invalid_reason';
  end if;

  perform public.close_order_unfulfilled(o);
  update public.orders
     set status = 'cancelled', cancelled_by = uid, cancel_reason = p_reason, closed_at = now(),
         otp_hash = null, otp_expires_at = null
   where id = o.id
  returning * into o;

  other := case when uid = o.requester_id then o.owner_id else o.requester_id end;
  perform public.notify(other, 'order_cancelled', 'Exchange cancelled',
                        '"' || o.listing_title || '" was cancelled.', o.id, o.listing_id);
  return o;
end $$;

create function public.open_dispute(p_order uuid, p_details text)
returns public.orders
language plpgsql security definer set search_path = public, extensions as $$
declare
  uid uuid := public.require_uid();
  o public.orders;
begin
  select * into o from public.orders where id = p_order for update;
  if not found or uid not in (o.requester_id, o.owner_id) then
    raise exception 'order_not_found';
  end if;
  if o.status not in ('ready_for_pickup', 'completed') then
    raise exception 'invalid_transition';
  end if;
  update public.orders set status = 'disputed' where id = o.id returning * into o;
  insert into public.reports (reporter_id, target_type, target_id, reason, details)
  values (uid, 'order', o.id::text, 'dispute', left(p_details, 1000));
  perform public.notify(case when uid = o.requester_id then o.owner_id else o.requester_id end,
                        'order_disputed', 'Exchange under review',
                        'A problem was reported with "' || o.listing_title || '". Our team will review it.',
                        o.id, o.listing_id);
  return o;
end $$;

-- Admin: refund=true reverses any settlement (or releases the hold); refund=false
-- restores the order (completed if it was settled, otherwise ready for pickup).
create function public.admin_resolve_dispute(p_order uuid, p_refund boolean)
returns public.orders
language plpgsql security definer set search_path = public, extensions as $$
declare
  uid uuid := public.require_uid();
  o public.orders;
  s public.settlements;
  entries jsonb;
begin
  if not public.is_admin(uid) then
    raise exception 'forbidden';
  end if;
  select * into o from public.orders where id = p_order for update;
  if not found or o.status <> 'disputed' then
    raise exception 'invalid_transition';
  end if;
  select * into s from public.settlements where order_id = o.id;

  if p_refund then
    if s.order_id is not null and s.total_credits > 0 then
      entries := jsonb_build_array(
        jsonb_build_object('account_id', o.requester_id, 'amount', s.total_credits, 'kind', 'reversal', 'order_id', o.id),
        jsonb_build_object('account_id', o.owner_id, 'amount', -o.price_credits, 'kind', 'reversal', 'order_id', o.id));
      if o.fee_credits > 0 then
        entries := entries || jsonb_build_array(
          jsonb_build_object('account_id', null, 'amount', -o.fee_credits, 'kind', 'reversal', 'order_id', o.id));
      end if;
      perform public.ledger_post(gen_random_uuid(), entries);
    else
      perform public.close_order_unfulfilled(o);
    end if;
    update public.orders set status = 'cancelled', cancel_reason = 'other', closed_at = now()
     where id = o.id returning * into o;
  else
    update public.orders
       set status = case when s.order_id is not null then 'completed' else 'ready_for_pickup' end
     where id = o.id returning * into o;
  end if;
  update public.reports set status = 'actioned', resolved_by = uid
   where target_type = 'order' and target_id = o.id::text and status = 'open';
  return o;
end $$;

-- Scheduled (service role): expire stale requests/reservations and food past its expiry.
create function public.expire_stale() returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  o public.orders;
  n_orders int := 0;
  n_listings int;
begin
  for o in
    select * from public.orders
     where (status = 'requested' and created_at < now() - make_interval(hours => public.cfg_int('request_ttl_hours')::int))
        or (status in ('accepted', 'ready_for_pickup')
            and accepted_at < now() - make_interval(hours => public.cfg_int('pickup_ttl_hours')::int))
     for update skip locked
  loop
    perform public.close_order_unfulfilled(o);
    update public.orders set status = 'expired', closed_at = now(), otp_hash = null where id = o.id;
    perform public.notify(o.requester_id, 'order_expired', 'Request expired',
                          '"' || o.listing_title || '" expired before pickup.', o.id, o.listing_id);
    n_orders := n_orders + 1;
  end loop;

  update public.listings set status = 'archived'
   where status = 'available' and expires_at is not null and expires_at <= now();
  get diagnostics n_listings = row_count;
  return jsonb_build_object('orders_expired', n_orders, 'listings_archived', n_listings);
end $$;

-- ---------------------------------------------------------------------------
-- Messaging
-- ---------------------------------------------------------------------------
create function public.get_or_create_chat(p_other uuid, p_listing uuid default null)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  uid uuid := public.require_uid();
  a uuid := least(uid, p_other);
  b uuid := greatest(uid, p_other);
  l public.listings;
  cid uuid;
begin
  if p_other is null or p_other = uid then
    raise exception 'invalid_recipient';
  end if;
  if not exists (select 1 from public.profiles where id = p_other and deleted_at is null) then
    raise exception 'invalid_recipient';
  end if;
  if public.is_blocked(uid, p_other) then
    raise exception 'blocked';
  end if;
  if p_listing is not null then
    select * into l from public.listings where id = p_listing;
    if not found or l.owner_id not in (uid, p_other) then
      raise exception 'listing_unavailable';
    end if;
  end if;

  insert into public.chats (listing_id, user_a, user_b, listing_title)
  values (p_listing, a, b, l.title)
  on conflict (coalesce(listing_id, '00000000-0000-0000-0000-000000000000'::uuid), user_a, user_b) do nothing
  returning id into cid;

  if cid is null then
    select id into cid from public.chats
     where coalesce(listing_id, '00000000-0000-0000-0000-000000000000'::uuid)
           = coalesce(p_listing, '00000000-0000-0000-0000-000000000000'::uuid)
       and user_a = a and user_b = b;
  else
    insert into public.interactions (user_id, listing_id, event) select uid, p_listing, 'chat' where p_listing is not null;
  end if;
  return cid;
end $$;

create function public.messages_after_insert() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  update public.chats
     set last_message_at = new.created_at,
         last_message_preview = case when new.flagged then 'Message hidden' else left(new.body, 120) end
   where id = new.chat_id;
  insert into public.chat_reads (chat_id, user_id, last_read_id) values (new.chat_id, new.sender_id, new.id)
  on conflict (chat_id, user_id) do update set last_read_id = greatest(chat_reads.last_read_id, excluded.last_read_id);
  return new;
end $$;

create trigger messages_after_insert after insert on public.messages
  for each row execute function public.messages_after_insert();

create function public.mark_chat_read(p_chat uuid, p_last_id bigint) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  uid uuid := public.require_uid();
begin
  if not exists (select 1 from public.chats where id = p_chat and uid in (user_a, user_b)) then
    raise exception 'chat_not_found';
  end if;
  insert into public.chat_reads (chat_id, user_id, last_read_id) values (p_chat, uid, p_last_id)
  on conflict (chat_id, user_id) do update set last_read_id = greatest(chat_reads.last_read_id, excluded.last_read_id);
end $$;

create function public.my_inbox()
returns table (
  chat_id uuid, listing_id uuid, listing_title text, other_user_id uuid, other_name text,
  other_avatar text, last_message_at timestamptz, last_message_preview text, unread_count bigint
)
language sql stable security definer set search_path = public, extensions as $$
  select c.id, c.listing_id, c.listing_title, p.id, p.display_name, p.avatar_url,
         c.last_message_at, c.last_message_preview,
         (select count(*) from public.messages m
           where m.chat_id = c.id and m.sender_id <> auth.uid()
             and m.id > coalesce((select r.last_read_id from public.chat_reads r
                                   where r.chat_id = c.id and r.user_id = auth.uid()), 0))
  from public.chats c
  join public.public_profiles p on p.id = case when c.user_a = auth.uid() then c.user_b else c.user_a end
  where auth.uid() in (c.user_a, c.user_b)
    and not public.is_blocked(c.user_a, c.user_b)
  order by c.last_message_at desc nulls last
$$;

-- ---------------------------------------------------------------------------
-- Discovery & recommendations
-- ---------------------------------------------------------------------------
create function public.user_taste_vector(p_user uuid) returns vector
language sql stable security definer set search_path = public, extensions as $$
  select avg(e.embedding)
  from public.interactions i
  join public.listing_embeddings e on e.listing_id = i.listing_id
  where i.user_id = p_user
    and i.event in ('view', 'save', 'request', 'chat', 'complete')
    and i.created_at > now() - interval '90 days'
$$;

-- Candidate generation for the "For you" feed (service role). The backend/ML ranker
-- re-scores these; ordering here is only a cheap first pass.
create function public.recommend_candidates(
  p_user uuid, p_lat float8 default null, p_lng float8 default null,
  p_kind text default null, p_limit int default 200
)
returns table (
  listing_id uuid, similarity float8, distance_km float8, age_hours float8,
  hours_to_expiry float8, popularity bigint, owner_reliability numeric, kind text,
  exchange_mode text, price_credits int, category text, has_image boolean
)
language sql stable security definer set search_path = public, extensions as $$
  with taste as (select public.user_taste_vector(p_user) as v)
  select l.id,
         case when t.v is null or e.embedding is null then null
              else 1 - (e.embedding <=> t.v) end,
         public.haversine_km(p_lat, p_lng, l.lat, l.lng),
         extract(epoch from now() - l.created_at) / 3600.0,
         case when l.expires_at is null then null else extract(epoch from l.expires_at - now()) / 3600.0 end,
         (select count(*) from public.interactions i
           where i.listing_id = l.id and i.event in ('view', 'save', 'request')
             and i.created_at > now() - interval '7 days'),
         op.reliability_score,
         l.kind, l.exchange_mode, l.price_credits, l.category, cardinality(l.images) > 0
  from public.listings l
  cross join taste t
  left join public.listing_embeddings e on e.listing_id = l.id
  left join public.profiles op on op.id = l.owner_id
  where l.status = 'available'
    and (l.expires_at is null or l.expires_at > now())
    and (p_user is null or l.owner_id <> p_user)
    and (p_user is null or not public.is_blocked(p_user, l.owner_id))
    and (p_kind is null or l.kind = p_kind)
    and not exists (select 1 from public.interactions d
                     where d.user_id = p_user and d.listing_id = l.id and d.event = 'dismiss')
  order by case when t.v is null or e.embedding is null then null else e.embedding <=> t.v end nulls last,
           l.created_at desc
  limit least(greatest(p_limit, 1), 500)
$$;

create function public.similar_listings(p_listing uuid, p_limit int default 6)
returns table (listing_id uuid, similarity float8)
language sql stable security definer set search_path = public, extensions as $$
  select l.id, 1 - (e.embedding <=> src.embedding)
  from public.listing_embeddings src
  join public.listing_embeddings e on e.listing_id <> src.listing_id
  join public.listings l on l.id = e.listing_id
  where src.listing_id = p_listing
    and l.status = 'available' and (l.expires_at is null or l.expires_at > now())
  order by e.embedding <=> src.embedding
  limit least(greatest(p_limit, 1), 24)
$$;

-- ---------------------------------------------------------------------------
-- ML training views (service role only; see 0003 grants)
-- ---------------------------------------------------------------------------
-- One row per closed order with features known at request time and the outcome label.
create view public.ml_order_outcomes as
  select o.id as order_id,
         o.created_at,
         o.requester_id,
         o.owner_id,
         l.kind,
         l.exchange_mode,
         o.price_credits,
         extract(hour from o.created_at)::int as request_hour,
         extract(epoch from o.created_at - rp.created_at) / 86400.0 as requester_age_days,
         public.haversine_km(rp.lat, rp.lng, l.lat, l.lng) as distance_km,
         (select count(*) from public.orders p where p.requester_id = o.requester_id
            and p.created_at < o.created_at and p.status = 'completed') as prior_completed,
         (select count(*) from public.orders p where p.requester_id = o.requester_id
            and p.created_at < o.created_at
            and ((p.status = 'cancelled' and (p.cancelled_by = p.requester_id or p.cancel_reason = 'no_show'))
                 or (p.status = 'expired' and p.accepted_at is not null))) as prior_failed,
         (select count(*) from public.reports r where r.target_type = 'user'
            and r.target_id = o.requester_id::text and r.created_at < o.created_at) as prior_reports,
         case when o.status = 'completed' then 1 else 0 end as completed
  from public.orders o
  join public.listings l on l.id = o.listing_id
  join public.profiles rp on rp.id = o.requester_id
  -- Label 0 only when the requester is responsible: they cancelled, no-showed, or let an
  -- accepted reservation expire. Owner-side failures are excluded.
  where o.status = 'completed'
     or (o.status = 'cancelled' and (o.cancelled_by = o.requester_id or o.cancel_reason = 'no_show'))
     or (o.status = 'expired' and o.accepted_at is not null);

-- Community / personal impact totals (service role; exposed through the backend).
create function public.impact_summary(p_user uuid default null) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
    'exchanges',      count(*),
    'food_exchanges', count(*) filter (where l.kind = 'food'),
    'kg_co2e',        coalesce(round(sum(o.impact_kg_co2e), 1), 0),
    'kg_waste',       coalesce(round(sum(o.impact_kg_waste), 1), 0),
    'members',        count(distinct o.requester_id) + count(distinct o.owner_id)
  )
  from public.orders o
  join public.listings l on l.id = o.listing_id
  where o.status = 'completed'
    and (p_user is null or p_user in (o.requester_id, o.owner_id))
$$;
