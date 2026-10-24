-- Users who signed up before the schema existed have no profile/wallet (the signup
-- trigger never fired for them). Create both, plus the one-time bonus. Idempotent.
do $$
declare
  u record;
  bonus bigint := coalesce(public.cfg_int('signup_bonus_credits'), 0);
begin
  for u in select au.* from auth.users au left join public.profiles p on p.id = au.id where p.id is null loop
    insert into public.profiles (id, display_name)
    values (u.id, left(coalesce(nullif(u.raw_user_meta_data->>'name', ''), split_part(coalesce(u.email, ''), '@', 1)), 80))
    on conflict (id) do nothing;
    insert into public.wallets (user_id) values (u.id) on conflict (user_id) do nothing;
    if bonus > 0 and not exists (select 1 from public.credit_ledger where account_id = u.id and kind = 'signup_bonus') then
      perform public.ledger_post(gen_random_uuid(), jsonb_build_array(
        jsonb_build_object('account_id', null, 'amount', -bonus, 'kind', 'signup_bonus', 'description', 'Welcome bonus'),
        jsonb_build_object('account_id', u.id, 'amount', bonus, 'kind', 'signup_bonus', 'description', 'Welcome bonus')));
    end if;
  end loop;
end $$;
