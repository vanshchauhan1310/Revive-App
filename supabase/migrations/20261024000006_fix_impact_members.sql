-- impact_summary counted a person twice when they had both given and received.
create or replace function public.impact_summary(p_user uuid default null) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  with done as (
    select o.*, l.kind from public.orders o join public.listings l on l.id = o.listing_id
    where o.status = 'completed' and (p_user is null or p_user in (o.requester_id, o.owner_id))
  )
  select jsonb_build_object(
    'exchanges',      (select count(*) from done),
    'food_exchanges', (select count(*) from done where kind = 'food'),
    'kg_co2e',        (select coalesce(round(sum(impact_kg_co2e), 1), 0) from done),
    'kg_waste',       (select coalesce(round(sum(impact_kg_waste), 1), 0) from done),
    'members',        (select count(distinct m) from (select requester_id m from done union select owner_id from done) x)
  )
$$;
revoke execute on function public.impact_summary(uuid) from public, anon, authenticated;
